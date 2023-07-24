const b4a = require('b4a')
const ReadyResource = require('ready-resource')
const FIFO = require('fast-fifo')
const debounceify = require('debounceify')
const c = require('compact-encoding')
const safetyCatch = require('safety-catch')
const assert = require('nanoassert')

const Linearizer = require('./lib/linearizer')
const Autocore = require('./lib/core')
const SystemView = require('./lib/system')
const messages = require('./lib/messages')
const NodeBuffer = require('./lib/node-buffer')
const Timer = require('./lib/timer')

const inspect = Symbol.for('nodejs.util.inspect.custom')
const REFERRER_USERDATA = 'referrer'
const VIEW_NAME_USERDATA = 'autobase/view'

// default is not to ack
const DEFAULT_ACK_INTERVAL = 0
const DEFAULT_ACK_THRESHOLD = 0

const { FLAG_OPLOG_IS_CHECKPOINTER } = messages

class Writer {
  constructor (base, core, length) {
    this.base = base
    this.core = core
    this.nodes = new NodeBuffer(length)
    this.indexed = length

    this.next = null
    this.nextCache = []
  }

  get length () {
    return this.nodes.length
  }

  compare (writer) {
    return b4a.compare(this.core.key, writer.core.key)
  }

  head () {
    return this.nodes.get(this.nodes.length - 1)
  }

  shift () {
    return this.nodes.shift()
  }

  getCached (seq) {
    return this.nodes.get(seq)
  }

  advance (node = this.next) {
    this.nodes.push(node)
    this.next = null
    return node
  }

  append (value, dependencies, batch) {
    const node = Linearizer.createNode(this, this.length + 1, value, [], batch, dependencies)

    for (const dep of dependencies) {
      if (!dep.yielded) {
        node.clock.add(dep.clock)
      }

      node.heads.push({
        key: dep.writer.core.key,
        length: dep.length
      })
    }

    node.clock.set(node.writer.core.key, node.length)

    this.advance(node)
    return node
  }

  async ensureNext () {
    if (this.length >= this.core.length || this.core.length === 0) return null
    if (this.next !== null) return this.next

    const cache = this.nextCache

    if (!cache.length && !(await this.core.has(this.length + cache.length))) return null

    while (!cache.length || cache[cache.length - 1].batch !== 1) {
      const { node } = await this.core.get(this.length + cache.length)
      const value = node.value == null ? null : c.decode(this.base.valueEncoding, node.value)
      cache.push(Linearizer.createNode(this, this.length + cache.length + 1, value, node.heads, node.batch, []))
    }

    this.next = await this.ensureNode(cache)
    return this.next
  }

  async ensureNode (batch) {
    const last = batch[batch.length - 1]
    if (last.batch !== 1) return null

    const node = batch.shift()

    while (node.dependencies.size < node.heads.length) {
      const rawHead = node.heads[node.dependencies.size]

      const headWriter = await this.base._getWriterByKey(rawHead.key)
      if (headWriter === null || headWriter.length < rawHead.length) {
        return null
      }

      const headNode = headWriter.getCached(rawHead.length - 1)

      if (headNode === null) { // already yielded
        popAndSwap(node.heads, node.dependencies.size)
        continue
      }

      node.dependencies.add(headNode)

      await this._addClock(node.clock, headNode)
    }

    node.clock.set(node.writer.core.key, node.length)

    return node
  }

  async getCheckpoint (index) {
    await this.core.update()

    let length = this.core.length
    if (length === 0) return null

    let node = await this.core.get(length - 1)

    let target = node.checkpoint[index]
    if (!target) return null

    if (!target.checkpoint) {
      length -= target.checkpointer
      node = await this.core.get(length - 1)
      target = node.checkpoint[index]
    }

    return target.checkpoint
  }

  async _addClock (clock, node) {
    if (node.yielded) return // gc'ed
    for (const [key, length] of node.clock) {
      if (clock.get(key) < length && !(await this.base.system.isIndexed(key, length))) {
        clock.set(key, length)
      }
    }
  }
}

class LinearizedStore {
  constructor (base) {
    this.base = base
    this.opened = new Map()
    this.waiting = []
  }

  get (opts, moreOpts) {
    if (typeof opts === 'string') opts = { name: opts }
    if (moreOpts) opts = { ...opts, ...moreOpts }

    const name = opts.name
    const valueEncoding = opts.valueEncoding || null

    if (this.opened.has(name)) return this.opened.get(name).createSession(valueEncoding)

    const core = this.base.store.get({ name: 'view/' + name, exclusive: true })
    const ac = new Autocore(this.base, core, name)

    this.waiting.push(ac)
    this.opened.set(name, ac)

    return ac.createSession(valueEncoding)
  }

  async update () {
    while (this.waiting.length) {
      const core = this.waiting.pop()
      await core.ready()
    }
  }
}

module.exports = class Autobase extends ReadyResource {
  constructor (store, bootstrap, handlers) {
    if (Array.isArray(bootstrap)) bootstrap = bootstrap[0] // TODO: just a quick compat, lets remove soon
    super()

    this.sparse = false
    this.bootstrap = bootstrap ? toKey(bootstrap) : null
    this.valueEncoding = c.from(handlers.valueEncoding || 'binary')
    this.store = store
    this._primaryBootstrap = null
    this._mainStore = null

    if (this.bootstrap) {
      this._primaryBootstrap = this.store.get({ key: this.bootstrap })
      this._mainStore = this.store
      this.store = this.store.namespace(this._primaryBootstrap)
    }

    this.local = Autobase.getLocalCore(this.store)
    this.localWriter = null
    this.linearizer = null

    this.writers = []

    this._appending = new FIFO()

    this._applying = null

    this._needsReady = []
    this._updates = []
    this._handlers = handlers || {}

    this._bump = debounceify(this._advance.bind(this))
    this._onremotewriterchangeBound = this._onremotewriterchange.bind(this)

    this.version = 0 // todo: set version

    this._openingCores = null

    this._hasApply = !!this._handlers.apply
    this._hasOpen = !!this._handlers.open
    this._hasClose = !!this._handlers.close

    this._viewStore = new LinearizedStore(this)
    this.view = null

    // preloader will be replaced
    this.system = new SystemView(null, this.store.get({ name: 'view/system', exclusive: true }))

    this._ackInterval = handlers.ackInterval || DEFAULT_ACK_INTERVAL
    this._ackThreshold = handlers.ackThreshold || DEFAULT_ACK_THRESHOLD
    this._ackTimer = null
    this._ackSize = 0
    this._acking = false

    // view opens after system is loaded
    this.view = null

    this.ready().catch(safetyCatch)
  }

  [inspect] (depth, opts) {
    let indent = ''
    if (typeof opts.indentationLvl === 'number') {
      while (indent.length < opts.indentationLvl) indent += ' '
    }

    return indent + 'Autobase { ... }'
  }

  // TODO: compat, will be removed
  get bootstraps () {
    return [this.bootstrap]
  }

  get writable () {
    return this.localWriter !== null
  }

  get key () {
    return this._primaryBootstrap === null ? this.local.key : this._primaryBootstrap.key
  }

  get discoveryKey () {
    return this._primaryBootstrap === null ? this.local.discoveryKey : this._primaryBootstrap.discoveryKey
  }

  async _openSystem () {
    await this.system.core.close()

    const autocore = this._viewStore.get({ name: 'system', exclusive: true })
    await autocore.ready()

    this.system = new SystemView(this, autocore)

    await this.system.ready()
  }

  async _openCores () {
    await this.store.ready()
    await this.local.ready()
    await this.system.ready()
  }

  async _open () {
    await (this._openingCores = this._openCores())

    if (this.system.bootstrapping && !this.bootstrap) {
      this.bootstrap = this.local.key // new autobase!
    }

    // reindex to load writers
    this._reindex()

    // see if we can load from indexer checkpoint
    await this._openSystem()

    await this._ensureUserData(this.system.core, null)

    if (this._hasOpen) this.view = this._handlers.open(this._viewStore, this)

    if (this.localWriter && this._ackInterval) this._startAckTimer()
    return this.update()
  }

  async _close () {
    if (this._hasClose) await this._handlers.close(this.view)
    if (this._primaryBootstrap) await this._primaryBootstrap.close()
    await this.store.close()
    if (this._ackTimer) this._ackTimer.stop()
    if (this._mainStore) await this._mainStore.close()
  }

  async _ensureUserData (core, name) {
    await core.setUserData(REFERRER_USERDATA, this.key)
    if (name) {
      await core.setUserData(VIEW_NAME_USERDATA, b4a.from(name))
    }
  }

  async _ensureAllCores () {
    while (this._needsReady.length > 0) {
      const core = this._needsReady.pop()
      await core.ready()
      await this._ensureUserData(core, null)
    }
  }

  _startAckTimer () {
    if (this._ackTimer) return
    this._ackTimer = new Timer(this.ack.bind(this), this._ackInterval)
    this._bumpAckTimer()
  }

  _bumpAckTimer () {
    if (!this._ackTimer) return
    this._ackTimer.bump()
  }

  _triggerAck () {
    if (this._ackTimer) {
      return this._ackTimer.trigger()
    } else {
      return this.ack()
    }
  }

  async update (opts) {
    if (!this.opened && !this._openingCores) await this.ready()

    for (const w of this.writers) {
      await w.core.update(opts)
      if (!this.sparse) await downloadAll(w.core)
    }

    await this._bump()
  }

  // runs in bg, not allowed to throw
  async _onremotewriterchange () {
    await this._bump()
    this._bumpAckTimer()
  }

  async ack () {
    if (!this.localWriter.isIndexer || this._acking) return

    this._acking = true

    await this.update({ wait: true })

    if (this._ackTimer) {
      const ackSize = this.linearizer.size
      if (this._ackSize && this._ackSize < ackSize) {
        this._ackTimer.extend()
      } else {
        this._ackTimer.reset()
      }

      this._ackSize = ackSize
    }

    if (this.linearizer.shouldAck(this.localWriter)) {
      await this.append(null)
    }

    this._acking = false
  }

  async append (value) {
    if (!this.opened) await this.ready()

    if (this.localWriter === null) {
      throw new Error('Not writable')
    }

    if (Array.isArray(value)) {
      for (const v of value) this._appending.push(v)
    } else {
      this._appending.push(value)
    }

    await this._bump()
  }

  async checkpoint () {
    await this.ready()
    const all = []

    for (const w of this.writers) {
      all.push(w.getCheckpoint())
    }

    const checkpoints = await Promise.all(all)
    let best = null

    for (const c of checkpoints) {
      if (!c) continue
      if (best === null || c.length > best.length) best = c
    }

    return best
  }

  static getLocalCore (store) {
    return store.get({ name: 'local', exclusive: true, valueEncoding: messages.OplogMessage })
  }

  static async getUserData (core) {
    const viewName = await core.getUserData(VIEW_NAME_USERDATA)
    return {
      referrer: await core.getUserData(REFERRER_USERDATA),
      view: viewName ? b4a.toString(viewName) : null
    }
  }

  static async isAutobase (core, opts = {}) {
    const block = await core.get(0, opts)
    if (!block) throw new Error('Core is empty.')
    if (!b4a.isBuffer(block)) return isAutobaseMessage(block)

    try {
      const m = c.decode(messages.OplogMessage, block)
      return isAutobaseMessage(m)
    } catch {
      return false
    }
  }

  _getWriterByKey (key, len = 0) {
    for (const w of this.writers) {
      if (b4a.equals(w.core.key, key)) return w
    }

    const w = this._makeWriter(key, len)
    this.writers.push(w)

    return w
  }

  _ensureAll () {
    const p = []
    for (const w of this.writers) {
      if (w.next === null) p.push(w.ensureNext())
    }
    return Promise.all(p)
  }

  _makeWriter (key, length) {
    const local = b4a.equals(key, this.local.key)

    const core = local
      ? this.local.session({ valueEncoding: messages.OplogMessage })
      : this.store.get({ key, sparse: this.sparse, valueEncoding: messages.OplogMessage })

    // Small hack for now, should be fixed in hypercore (that key is set immediatly)
    core.key = key
    this._needsReady.push(core)

    const w = new Writer(this, core, length)

    if (local) {
      this.localWriter = w
      if (this._ackInterval) this._startAckTimer()
    } else {
      core.on('append', this._onremotewriterchangeBound)
    }

    return w
  }

  _reindex (change) {
    const indexers = []

    if (this.system.bootstrapping) {
      const bootstrap = this._makeWriter(this.bootstrap, 0)
      indexers.push(bootstrap)
      this.writers = indexers.slice()
      bootstrap.isIndexer = true
    } else {
      for (const { key, length, indexer } of this.system.digest.writers) {
        const writer = this._getWriterByKey(key, length)
        if (!indexer) continue
        indexers.push(writer)
        writer.isIndexer = true
      }
    }

    const heads = []

    for (const head of this.system.digest.heads) {
      for (const w of indexers) {
        if (b4a.equals(w.core.key, head.key)) {
          const headNode = Linearizer.createNode(w, head.length, null, [], 1, [])
          headNode.yielded = true
          heads.push(headNode)
        }
      }
    }

    const clock = this.system.digest.writers.map(w => {
      const writer = this._getWriterByKey(w.key)
      return { writer, length: w.length }
    })

    this.linearizer = new Linearizer(indexers, heads, clock)

    if (change) this._reloadUpdate(change, heads)
  }

  _reloadUpdate (change, heads) {
    const { count, nodes } = change

    this._undo(count)

    for (const node of nodes) {
      node.yielded = false
      node.dependents.clear()

      for (let i = 0; i < node.heads.length; i++) {
        const link = node.heads[i]

        const writer = this._getWriterByKey(link.key)
        if (node.clock.get(writer.core.key) < link.length) {
          node.clock.set(writer.core.key, link.length)
        }

        for (const head of heads) {
          if (compareHead(link, head)) {
            node.dependencies.add(head)
            break
          }
        }
      }

      heads.push(node)
    }

    for (const node of nodes) {
      this.linearizer.addHead(node)
    }
  }

  async _addHeads () {
    let active = true
    let added = 0

    while (active && added < 50) { // 50 here is just to reduce the bulk batches
      await this._ensureAll()

      active = false
      for (const w of this.writers) {
        if (!w.next) continue

        while (w.next) {
          const node = w.advance()
          this.linearizer.addHead(node)
          if (node.batch === 1) {
            added++
            break
          }
        }

        active = true
        break
      }
    }
  }

  async _advance () {
    while (true) {
      while (!this._appending.isEmpty()) {
        const batch = this._appending.length
        const value = this._appending.shift()

        // filter out pointless acks
        if (value === null && !this._appending.isEmpty()) continue

        const heads = new Set(this.linearizer.heads)
        const node = this.localWriter.append(value, heads, batch)
        this.linearizer.addHead(node)
      }

      await this._addHeads()

      const u = this.linearizer.update()
      const changed = u ? await this._applyUpdate(u) : null

      if (this.localWriter !== null && this.localWriter.length > this.local.length) {
        await this._flushLocal()
      }

      if (!changed) break

      this._reindex(changed)
    }

    // skip threshold check while acking
    if (this._ackThreshold && !this._acking) {
      const n = this._ackThreshold * this.linearizer.indexers.length

      // await here would cause deadlock, fine to run in bg
      if (this.linearizer.size >= (1 + Math.random()) * n) this._triggerAck()
    }

    return this._ensureAllCores()
  }

  // triggered from linearized core
  _onuserappend (core, blocks) {
    assert(this._applying !== null, 'Append is only allowed in apply')

    if (core.appending === 0) {
      this._applying.user.push({ core, appending: 0 })
    }

    core.appending += blocks
  }

  _onsystemappend (blocks) {
    assert(this._applying !== null, 'System changes are only allowed in apply')

    this._applying.system += blocks
  }

  // triggered from system
  _onaddwriter (key, indexer) {
    assert(this._applying !== null, 'System changes are only allowed in apply')

    for (const w of this.writers) {
      if (b4a.equals(w.core.key, key)) return
    }

    const writer = this._makeWriter(key, 0)
    this.writers.push(writer)

    if (indexer) writer.isIndexer = true

    // fetch any nodes needed for dependents
    this._bump()
  }

  _undo (popped) {
    const truncating = []

    while (popped > 0) {
      const u = this._updates.pop()

      popped -= u.batch

      for (const { core, appending } of u.user) {
        if (core.truncating === 0) truncating.push(core)
        core.truncating += appending
      }
    }

    for (const core of truncating) {
      const truncating = core.truncating
      core.truncating = 0
      core._onundo(truncating)
    }
  }

  _bootstrap () {
    this.system.addWriter(this.bootstrap, true)
  }

  async _applyUpdate (u) {
    await this._viewStore.update()

    if (u.popped) this._undo(u.popped)

    let batch = 0
    let applyBatch = []

    let j = 0

    let i = 0
    while (i < Math.min(u.indexed.length, u.shared)) {
      const node = u.indexed[i++]

      node.writer.indexed++
      node.writer.shift().clear()

      if (node.batch > 1) continue

      const update = this._updates[j++]
      if (update.system === 0) continue

      await this._flushIndexes(i)

      const nodes = u.indexed.slice(i).concat(u.tip)
      return { count: u.shared - i, nodes }
    }

    for (i = u.shared; i < u.length; i++) {
      const indexed = i < u.indexed.length
      const node = indexed ? u.indexed[i] : u.tip[i - u.indexed.length]

      if (indexed) node.writer.indexed++

      batch++

      if (node.value !== null) {
        applyBatch.push({
          indexed,
          from: node.writer.core,
          length: node.length,
          value: node.value,
          heads: node.heads
        })
      }

      if (node.batch > 1) continue

      const update = { batch, system: 0, user: [] }

      this._updates.push(update)
      this._applying = update

      if (this.system.bootstrapping) await this._bootstrap()

      if (applyBatch.length && this._hasApply === true) {
        try {
          await this._handlers.apply(applyBatch, this.view, this)
        } catch (err) {
          // todo: recover/shutdown?
          this.emit('error', err)
          return null
        }
      }

      await this.system.flush(update, node)

      // local flushed in _flushLocal
      if (indexed && node.writer !== this.localWriter) {
        node.writer.shift()
        node.clear()
      }

      this._applying = null

      batch = []
      applyBatch = []

      for (let k = 0; k < update.user.length; k++) {
        const u = update.user[k]
        u.appending = u.core.appending
        u.core.appending = 0
      }

      if (update.system > 0 && indexed) {
        await this._flushIndexes(i + 1)

        const nodes = u.indexed.slice(i + 1).concat(u.tip)
        return { count: 0, nodes }
      }
    }

    if (u.indexed.length) {
      await this._flushIndexes(u.indexed.length)
    }

    return null
  }

  async _flushIndexes (indexed) {
    const updatedCores = []

    while (indexed > 0) {
      const u = this._updates.shift()

      indexed -= u.batch

      for (const { core, appending } of u.user) {
        const start = core.indexing
        const blocks = core.indexBatch(start, core.indexing += appending)
        if (start === 0) updatedCores.push(core)

        await core.core.append(blocks)
      }
    }

    for (const core of updatedCores) {
      const indexing = core.indexing
      core.indexing = 0
      core._onindex(indexing)

      if (core === this.system.core._source) {
        await this.system._onindex()
      }
    }
  }

  async _flushLocal () {
    const checkpoint = []
    if (this.localWriter.isIndexer) {
      for (const [, core] of this._viewStore.opened) {
        if (!core.indexedLength) continue
        checkpoint.push(core.checkpoint())
      }
    }

    const blocks = new Array(this.localWriter.length - this.local.length)

    for (let i = 0; i < blocks.length; i++) {
      const { value, heads, batch, yielded } = this.localWriter.getCached(this.local.length + i)

      if (yielded) this.localWriter.shift().clear()

      let flags = 0
      if (this.localWriter.isIndexer) flags |= FLAG_OPLOG_IS_CHECKPOINTER

      blocks[i] = {
        flags,
        version: this.version,
        checkpoint: checkpoint.sort(cmpCheckpoint),
        node: {
          heads,
          abi: 0,
          batch,
          value: value === null ? null : c.encode(this.valueEncoding, value)
        }
      }

      if (this.localWriter.isIndexer) {
        for (const [, core] of this._viewStore.opened) {
          if (core.indexedLength) core.checkpointer++
        }
      }
    }

    return this.local.append(blocks)
  }

  async loadIndex (name) {
    if (this.system.bootstrapping) return 0

    const idx = await this.system.getIndex(name)
    if (idx < 0) return 0

    // only indexers have checkpoints
    let indexer = this.localWriter
    if (!this.localWriter.isIndexer) {
      const indexerHeads = await this.system.digest.indexerHeads
      if (!indexerHeads.length) return 0 // no data

      indexer = this._getWriterByKey(indexerHeads[0].key)
    }

    const checkpoint = await indexer.getCheckpoint(idx)
    return checkpoint ? checkpoint.length : 0
  }
}

function toKey (k) {
  return b4a.isBuffer(k) ? k : b4a.from(k, 'hex')
}

function popAndSwap (list, i) {
  const pop = list.pop()
  if (i >= list.length) return false
  list[i] = pop
  return true
}

function downloadAll (core) {
  const start = core.length
  const end = core.core.tree.length

  return core.download({ start, end, ifAvailable: true }).done()
}

function compareHead (head, node) {
  return head.length === node.length && b4a.equals(head.key, node.writer.core.key)
}

function isAutobaseMessage (msg) {
  const indexer = msg.flags & FLAG_OPLOG_IS_CHECKPOINTER
  return indexer ? msg.checkpoint.length > 0 : msg.checkpoint.length === 0
}

function cmpCheckpoint (a, b) {
  return a.index - b.index
}
