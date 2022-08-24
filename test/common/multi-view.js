const test = require('tape')
const Hyperbee = require('hyperbee')
const lexint = require('lexicographic-integer')
const b = require('b4a')

const { create } = require('../helpers')

test('multi-view - two views, hyperbee and raw', async t => {
  const [baseA, baseB] = await create(2, { view: { localOnly: true }, opts: { autostart: false, eagerUpdate: true } })

  const viewOptions = {
    views: 2,
    open: (core1, core2) => [
      core1,
      new Hyperbee(core2, {
        keyEncoding: 'utf-8',
        valueEncoding: 'utf-8',
        extension: false
      })
    ],
    apply: async (core, bee, batch) => {
      const b = bee.batch({ update: false })
      for (const node of batch) {
        await core.append(node.value) // core just records the raw messages
        const pos = core.length - 1
        for (const word of node.value.toString().split(' ')) {
          const key = `${word}-${lexint.pack(pos, 'hex')}`
          await b.put(key, lexint.pack(pos, 'hex'))
        }
      }
      await b.flush()
    }
  }
  const [core1, bee1] = baseA.start(viewOptions)
  const [core2, bee2] = baseB.start(viewOptions)

  await baseA.append('hey there')
  await baseB.append('hey how is it going')
  await baseA.append('it is good')
  await baseB.append('ah nice that is hey')

  // Find the latest occurrence of 'hey'
  for await (const node of bee1.createReadStream({ gt: 'hey-', lt: 'hey-~', reverse: true })) { // eslint-disable-line
    t.is(b.toString(await core2.get(lexint.unpack(node.value, 'hex'))), 'ah nice that is hey')
    break
  }
  // Find the latest occurrence of 'good'
  for await (const node of bee2.createReadStream({ gt: 'good-', lt: 'good-~', reverse: true })) { // eslint-disable-line
    t.is(b.toString(await core1.get(lexint.unpack(node.value, 'hex'))), 'it is good')
    break
  }
})
