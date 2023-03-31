const test = require('brittle')
const { Linearizer, Writer } = require('../../')

test('fuzz 85f0d0', function (t) {
  const a = new Writer('a')
  const b = new Writer('b')
  const c = new Writer('c')
  const l = new Linearizer([a, b, c])


  const nodes = []

    const a0 = a.add()
    nodes.push(a0)
    const b0 = b.add(a0)
    nodes.push(b0)
    const c0 = c.add(b0)
    nodes.push(c0)
    const b1 = b.add(c0)
    nodes.push(b1)
    const a1 = a.add(b1)
    nodes.push(a1)
    const c1 = c.add(a1)
    nodes.push(c1)
    const a2 = a.add(c1)
    nodes.push(a2)
    const c2 = c.add(a2)
    nodes.push(c2)
    const a3 = a.add(c2)
    nodes.push(a3)
    const b2 = b.add(a3)
    nodes.push(b2)
    const a4 = a.add(b2)
    nodes.push(a4)
    const b3 = b.add(a4)
    nodes.push(b3)
    const c3 = c.add(b2)
    nodes.push(c3)
    const b4 = b.add(b3, c3)
    nodes.push(b4)
    const c4 = c.add(b4)
    nodes.push(c4)
    const b5 = b.add(c4)
    nodes.push(b5)
    const c5 = c.add(b5)
    nodes.push(c5)
    const a5 = a.add(c5)
    nodes.push(a5)
    const b6 = b.add(a5)
    nodes.push(b6)
    const c6 = c.add(b6)
    nodes.push(c6)
    const a6 = a.add(c6)
    nodes.push(a6)
    const b7 = b.add(a6)
    nodes.push(b7)
    const a7 = a.add(b7)
    nodes.push(a7)
    const b8 = b.add(a7)
    nodes.push(b8)
    const a8 = a.add(b8)
    nodes.push(a8)
    const b9 = b.add(a8)
    nodes.push(b9)
    const a9 = a.add(b9)
    nodes.push(a9)
    const b10 = b.add(a9)
    nodes.push(b10)
    const a10 = a.add(b10)
    nodes.push(a10)
    const b11 = b.add(a10)
    nodes.push(b11)
    const a11 = a.add(b11)
    nodes.push(a11)
    const b12 = b.add(a11)
    nodes.push(b12)
    const a12 = a.add(b12)
    nodes.push(a12)
    const b13 = b.add(a12)
    nodes.push(b13)
    const a13 = a.add(b13)
    nodes.push(a13)
    const b14 = b.add(a13)
    nodes.push(b14)
    const a14 = a.add(b14)
    nodes.push(a14)
    const b15 = b.add(a14)
    nodes.push(b15)
    const a15 = a.add(b15)
    nodes.push(a15)
    const b16 = b.add(a15)
    nodes.push(b16)
    const a16 = a.add(b16)
    nodes.push(a16)
    const b17 = b.add(a16)
    nodes.push(b17)
    const a17 = a.add(b17)
    nodes.push(a17)
    const b18 = b.add(a17)
    nodes.push(b18)
    const a18 = a.add(b18)
    nodes.push(a18)
    const b19 = b.add(a18)
    nodes.push(b19)
    const a19 = a.add(b19)
    nodes.push(a19)
    const b20 = b.add(a19)
    nodes.push(b20)
    const a20 = a.add(b20)
    nodes.push(a20)
    const b21 = b.add(a20)
    nodes.push(b21)
    const a21 = a.add(b21)
    nodes.push(a21)
    const b22 = b.add(a21)
    nodes.push(b22)
    const a22 = a.add(b22)
    nodes.push(a22)
    const b23 = b.add(a22)
    nodes.push(b23)
    const a23 = a.add(b23)
    nodes.push(a23)
    const b24 = b.add(a23)
    nodes.push(b24)
    const a24 = a.add(b24)
    nodes.push(a24)
    const b25 = b.add(a24)
    nodes.push(b25)
    const a25 = a.add(b25)
    nodes.push(a25)
    const b26 = b.add(a25)
    nodes.push(b26)
    const a26 = a.add(b26)
    nodes.push(a26)
    const b27 = b.add(a26)
    nodes.push(b27)
    const a27 = a.add(b27)
    nodes.push(a27)
    const b28 = b.add(a27)
    nodes.push(b28)
    const a28 = a.add(b28)
    nodes.push(a28)
    const b29 = b.add(a28)
    nodes.push(b29)
    const a29 = a.add(b29)
    nodes.push(a29)
    const b30 = b.add(a29)
    nodes.push(b30)
    const a30 = a.add(b30)
    nodes.push(a30)
    const b31 = b.add(a30)
    nodes.push(b31)
    const a31 = a.add(b31)
    nodes.push(a31)
    const b32 = b.add(a31)
    nodes.push(b32)
    const a32 = a.add(b32)
    nodes.push(a32)
    const b33 = b.add(a32)
    nodes.push(b33)
    const a33 = a.add(b33)
    nodes.push(a33)
    const b34 = b.add(a33)
    nodes.push(b34)
    const a34 = a.add(b34)
    nodes.push(a34)
    const b35 = b.add(a34)
    nodes.push(b35)
    const a35 = a.add(b35)
    nodes.push(a35)
    const b36 = b.add(a35)
    nodes.push(b36)
    const a36 = a.add(b36)
    nodes.push(a36)
    const b37 = b.add(a36)
    nodes.push(b37)
    const a37 = a.add(b37)
    nodes.push(a37)
    const b38 = b.add(a37)
    nodes.push(b38)
    const a38 = a.add(b38)
    nodes.push(a38)
    const b39 = b.add(a38)
    nodes.push(b39)
    const a39 = a.add(b39)
    nodes.push(a39)
    const b40 = b.add(a39)
    nodes.push(b40)
    const a40 = a.add(b40)
    nodes.push(a40)
    const b41 = b.add(a40)
    nodes.push(b41)
    const a41 = a.add(b41)
    nodes.push(a41)
    const b42 = b.add(a41)
    nodes.push(b42)
    const a42 = a.add(b42)
    nodes.push(a42)
    const b43 = b.add(a42)
    nodes.push(b43)
    const a43 = a.add(b43)
    nodes.push(a43)
    const b44 = b.add(a43)
    nodes.push(b44)
    const a44 = a.add(b44)
    nodes.push(a44)
    const b45 = b.add(a44)
    nodes.push(b45)
    const a45 = a.add(b45)
    nodes.push(a45)
    const b46 = b.add(a45)
    nodes.push(b46)
    const a46 = a.add(b46)
    nodes.push(a46)
    const b47 = b.add(a46)
    nodes.push(b47)
    const a47 = a.add(b47)
    nodes.push(a47)
    const b48 = b.add(a47)
    nodes.push(b48)
    const a48 = a.add(b48)
    nodes.push(a48)
    const b49 = b.add(a48)
    nodes.push(b49)
    const a49 = a.add(b49)
    nodes.push(a49)
    const b50 = b.add(a49)
    nodes.push(b50)
    const a50 = a.add(b50)
    nodes.push(a50)
    const b51 = b.add(a50)
    nodes.push(b51)
    const a51 = a.add(b51)
    nodes.push(a51)
    const b52 = b.add(a51)
    nodes.push(b52)
    const a52 = a.add(b52)
    nodes.push(a52)
    const b53 = b.add(a52)
    nodes.push(b53)
    const a53 = a.add(b53)
    nodes.push(a53)
    const b54 = b.add(a53)
    nodes.push(b54)
    const a54 = a.add(b54)
    nodes.push(a54)
    const b55 = b.add(a54)
    nodes.push(b55)
    const a55 = a.add(b55)
    nodes.push(a55)
    const b56 = b.add(a55)
    nodes.push(b56)
    const a56 = a.add(b56)
    nodes.push(a56)
    const b57 = b.add(a56)
    nodes.push(b57)
    const a57 = a.add(b57)
    nodes.push(a57)
    const b58 = b.add(a57)
    nodes.push(b58)
    const a58 = a.add(b58)
    nodes.push(a58)
    const b59 = b.add(a58)
    nodes.push(b59)
    const a59 = a.add(b59)
    nodes.push(a59)
    const b60 = b.add(a59)
    nodes.push(b60)
    const a60 = a.add(b60)
    nodes.push(a60)
    const b61 = b.add(a60)
    nodes.push(b61)
    const a61 = a.add(b61)
    nodes.push(a61)
    const b62 = b.add(a61)
    nodes.push(b62)
    const a62 = a.add(b62)
    nodes.push(a62)
    const b63 = b.add(a62)
    nodes.push(b63)
    const a63 = a.add(b63)
    nodes.push(a63)
    const b64 = b.add(a63)
    nodes.push(b64)
    const a64 = a.add(b64)
    nodes.push(a64)
    const b65 = b.add(a64)
    nodes.push(b65)
    const a65 = a.add(b65)
    nodes.push(a65)
    const b66 = b.add(a65)
    nodes.push(b66)
    const a66 = a.add(b66)
    nodes.push(a66)
    const b67 = b.add(a66)
    nodes.push(b67)
    const a67 = a.add(b67)
    nodes.push(a67)
    const b68 = b.add(a67)
    nodes.push(b68)
    const a68 = a.add(b68)
    nodes.push(a68)
    const b69 = b.add(a68)
    nodes.push(b69)
    const a69 = a.add(b69)
    nodes.push(a69)
    const b70 = b.add(a69)
    nodes.push(b70)
    const a70 = a.add(b70)
    nodes.push(a70)
    const b71 = b.add(a70)
    nodes.push(b71)
    const a71 = a.add(b71)
    nodes.push(a71)
    const b72 = b.add(a71)
    nodes.push(b72)
    const a72 = a.add(b72)
    nodes.push(a72)
    const b73 = b.add(a72)
    nodes.push(b73)
    const a73 = a.add(b73)
    nodes.push(a73)
    const b74 = b.add(a73)
    nodes.push(b74)
    const a74 = a.add(b74)
    nodes.push(a74)
    const b75 = b.add(a74)
    nodes.push(b75)
    const a75 = a.add(b75)
    nodes.push(a75)
    const b76 = b.add(a75)
    nodes.push(b76)


  let length
  let pos = 0
  while (true) {
    while (pos < pos + 20) {
      if (++pos >= 160) return t.end()
      l.addHead(nodes.shift())
    }

    const result = []
    while (true) {
      const n = l.shift()
      result.push(n)
      if (!n) break
      t.comment('yield #' + tick + ', ' + ref1)
    }

    t.not(length, result.length, 'loop ' + i)
  }
})