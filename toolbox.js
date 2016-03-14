/*jslint indent: 2 */
(function script() {
  "use strict";

  /*! Copyright (c) 2015 Tristan Cavelier <t.cavelier@free.fr>
      This program is free software. It comes without any warranty, to
      the extent permitted by applicable law. You can redistribute it
      and/or modify it under the terms of the Do What The Fuck You Want
      To Public License, Version 2, as published by Sam Hocevar. See
      http://www.wtfpl.net/ for more details. */

  /*jslint indent: 2, nomen: true */
  /*global window, exports,
           Blob, FileReader, ArrayBuffer, Uint8Array, Uint16Array, URL, XMLHttpRequest, DOMParser,
           setTimeout, clearTimeout, btoa, atob, document, open, localStorage */


  var toolbox = {}, textToUint8Array, textToArrayBuffer, textToBinaryString,
    uint8ArrayToText, arrayBufferToText, binaryStringToText,
    endianness,
    uriProtocolStringRegExp, urlUserPasswordCharsetStringRegExp,
    urlDomainStringRegExp, urlHostNameStringRegExp,
    urlPortStringRegExp,
    urlPathNameCharsetStringRegExp, urlQueryCharsetStringRegExp, urlHashCharsetStringRegExp,
    ipv6StringRegExp, decimalByteStringRegExp, ipv4StringRegExp,
    urlParserRegExp, localstorageURIParserRegExp, fileURIParserRegExp;

  if (typeof exports === "object" && exports !== null) {
    toolbox = exports;
  } else if (typeof window === "object" && window !== null) {
    window.toolbox = toolbox;
  }
  toolbox.toScript = function () {
    return "/*jslint indent: 2 */\n(" + script.toString() + "());\n";
  };


  //////////////////////////////////////////////////

  // uriComponentEncodeCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.!~\\*'\\(\\);,/\\?:@&=\\+\\$]";
  // uriEncodeCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.!~\\*'\\(\\)]";
  ipv6StringRegExp = "(?:" +
    "(?:(?:(?:[0-9A-Fa-f]{1,4}:){7}(?:[0-9A-Fa-f]{1,4}|:))|(?:(?:[0-9A-Fa-f]{" +
    "1,4}:){6}(?::[0-9A-Fa-f]{1,4}|(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)" +
    "(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(?:(?:[0-9A-Fa-f]" +
    "{1,4}:){5}(?:(?:(?::[0-9A-Fa-f]{1,4}){1,2})|:(?:(?:25[0-5]|2[0-4]\\d|1\\" +
    "d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(?" +
    ":(?:[0-9A-Fa-f]{1,4}:){4}(?:(?:(?::[0-9A-Fa-f]{1,4}){1,3})|(?:(?::[0-9A-" +
    "Fa-f]{1,4})?:(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|" +
    "2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(?:(?:[0-9A-Fa-f]{1,4}:){3}(?:(?:" +
    "(?::[0-9A-Fa-f]{1,4}){1,4})|(?:(?::[0-9A-Fa-f]{1,4}){0,2}:(?:(?:25[0-5]|" +
    "2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d" +
    ")){3}))|:))|(?:(?:[0-9A-Fa-f]{1,4}:){2}(?:(?:(?::[0-9A-Fa-f]{1,4}){1,5})" +
    "|(?:(?::[0-9A-Fa-f]{1,4}){0,3}:(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d" +
    ")(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(?:(?:[0-9A-Fa-" +
    "f]{1,4}:){1}(?:(?:(?::[0-9A-Fa-f]{1,4}){1,6})|(?:(?::[0-9A-Fa-f]{1,4}){0" +
    ",4}:(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d" +
    "|1\\d\\d|[1-9]?\\d)){3}))|:))|(?::(?:(?:(?::[0-9A-Fa-f]{1,4}){1,7})|(?:(" +
    "?::[0-9A-Fa-f]{1,4}){0,5}:(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:" +
    "\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))(?:%.+)?" + ")";
  decimalByteStringRegExp = "(?:0*(?:2(?:5[0-5]|[0-4]\\d)|1\\d\\d|\\d?\\d))";
  ipv4StringRegExp = "(?:" + decimalByteStringRegExp + "(?:\\." + decimalByteStringRegExp + "){3})";
  uriProtocolStringRegExp = "(?:[a-z]+:)";
  urlUserPasswordCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.]";
  urlDomainStringRegExp = "(?:[a-zA-Z0-9\\-_\\.]*[a-zA-Z])";
  urlPortStringRegExp = "(?:\\d{0,5})";
  urlHostNameStringRegExp = "(?:\\[" + ipv6StringRegExp + "\\]|" + ipv4StringRegExp + "|" + urlDomainStringRegExp + ")";
  // urlEscapedCharStringRegExp = "(?:%[0-9a-fA-F]{2})";
  // urlStrictPathNameCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.!~\\*'\\(\\);,/:@&=\\+\\$]";
  // urlStrictPathNameStringRegExp = "(?:(?:" + urlEscapedCharStringRegExp + "|" + urlStrictPathNameCharsetStringRegExp + ")+)";
  urlPathNameCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.!~\\*'\\(\\);,/:@&=\\+\\$%]";
  // urlStrictQueryCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.!~\\*'\\(\\);,/\\?:@&=\\+\\$]";
  // urlStrictQueryStringRegExp = "(?:(?:" + urlEscapedCharStringRegExp + "|" + urlStrictQueryCharsetStringRegExp + ")+)";
  urlQueryCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.!~\\*'\\(\\);,/\\?:@&=\\+\\$%]";
  // urlStrictHashCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.!~\\*'\\(\\);,/\\?:@&=\\+\\$#]";
  // urlStrictHashStringRegExp = "(?:(?:" + urlEscapedCharStringRegExp + "|" + urlStrictHashCharsetStringRegExp + ")+)";
  urlHashCharsetStringRegExp = "[a-zA-Z0-9\\-_\\.!~\\*'\\(\\);,/\\?:@&=\\+\\$#%]";

  //////////////////////////////////////////////////

  function generateUUID() {
    /**
     * An Universal Unique ID generator
     *
     * @return {String} The new UUID.
     */
    function S4() {
      return ("0000" + Math.floor(
        Math.random() * 0x10000
      ).toString(16)).slice(-4);
    }
    function S8() {
      return ("00000000" + Math.floor(
        Math.random() * 0x100000000
      ).toString(16)).slice(-8);
    }
    return S8() + "-" +
      S4() + "-" +
      S4() + "-" +
      S4() + "-" +
      S8() + S4();
  }
  toolbox.generateUUID = generateUUID;

  //////////////////////////////////////////////////

  function mixIn(fromCons, toCons) {
    // Mixes `fromCons` prototype to `toCons` prototype.
    // If a property already exists in `toCons` then it throws an error
    /*jslint forin: true */
    var k;
    for (k in fromCons.prototype) {
      if (toCons.prototype[k] !== undefined) {
        throw new Error("Property " + k + " of " + toCons.name + " is already defined");
      }
      toCons.prototype[k] = fromCons.prototype[k];
    }
  }
  toolbox.mixIn = mixIn;

  //////////////////////////////////////////////////

  function wrap(fn, args) {
    // This method is equal to `fn.bind(<ctx>, arg1, arg2, ..)` with `<ctx>` equal to
    // actual `fn` this argument.
    return function () {
      return fn.apply(this, [].concat(args, arguments));
    };
  }
  toolbox.wrap = wrap;

  //////////////////////////////////////////////////

  function detectEndianness() {
    var u = new Uint16Array(1);
    u[0] = 0xfeff;
    return new Uint8Array(u.buffer)[0] === 0xff ? "little" : "big";
  }
  toolbox.detectEndianness = detectEndianness;
  endianness = detectEndianness();
  toolbox.endianness = endianness;

  function utf16ArrayBufferToText(arrayBuffer) {
    return String.fromCharCode.apply(null, new Uint16Array(arrayBuffer));
  }
  toolbox.utf16ArrayBufferToText = utf16ArrayBufferToText;

  function utf16Uint16ArrayToText(uint16Array) {
    return String.fromCharCode.apply(null, uint16Array);
  }
  toolbox.utf16Uint16ArrayToText = utf16Uint16ArrayToText;

  function textToUtf16Uint16Array(text) {
    var i, s = new Uint16Array(text.length);
    for (i = 0; i < text.length; i += 1) {
      s[i] = text.charCodeAt(i);
    }
    return s;
  }
  toolbox.textToUtf16Uint16Array = textToUtf16Uint16Array;

  function textToUtf16ArrayBuffer(text) {
    return textToUtf16Uint16Array(text).buffer;
  }
  toolbox.textToUtf16ArrayBuffer = textToUtf16ArrayBuffer;

  function textToUtf16BigEndianUint8Array(text) {
    /*jslint bitwise: true */
    var i, chr, s = new Uint8Array(text.length * 2);
    for (i = 0; i < text.length; i += 1) {
      chr = text.charCodeAt(i);
      s[i * 2] = chr >>> 8;
      s[(i * 2) + 1] = chr;
    }
    return s;
  }
  toolbox.textToUtf16BigEndianUint8Array = textToUtf16BigEndianUint8Array;

  function textToUtf16BigEndianArrayBuffer(text) {
    return textToUtf16BigEndianUint8Array(text).buffer;
  }
  toolbox.textToUtf16BigEndianArrayBuffer = textToUtf16BigEndianArrayBuffer;

  function textToUtf16LittleEndianUint8Array(text) {
    /*jslint bitwise: true */
    var i, chr, s = new Uint8Array(text.length * 2);
    for (i = 0; i < text.length; i += 1) {
      chr = text.charCodeAt(i);
      s[i * 2] = chr;
      s[(i * 2) + 1] = chr >>> 8;
    }
    return s;
  }
  toolbox.textToUtf16LittleEndianUint8Array = textToUtf16LittleEndianUint8Array;

  function textToUtf16LittleEndianArrayBuffer(text) {
    return textToUtf16LittleEndianUint8Array(text).buffer;
  }
  toolbox.textToUtf16LittleEndianArrayBuffer = textToUtf16LittleEndianArrayBuffer;

  function textToUtf16BigEndianBinaryString(text) {
    /*jslint bitwise: true */
    var i, chr, s = "";
    for (i = 0; i < text.length; i += 1) {
      chr = text.charCodeAt(i);
      s += String.fromCharCode((chr & 0xff00) >>> 8, chr & 0xff);
    }
    return s;
  }
  toolbox.textToUtf16BigEndianBinaryString = textToUtf16BigEndianBinaryString;

  function textToUtf16LittleEndianBinaryString(text) {
    /*jslint bitwise: true */
    var i, chr, s = "";
    for (i = 0; i < text.length; i += 1) {
      chr = text.charCodeAt(i);
      s += String.fromCharCode(chr & 0xff, (chr & 0xff00) >>> 8);
    }
    return s;
  }
  toolbox.textToUtf16LittleEndianBinaryString = textToUtf16LittleEndianBinaryString;

  //////////////////////////////////////////////////

  function textToUtf8Uint8Array(sDOMStr) {
    /*jslint plusplus: true, bitwise: true */
    // Assuming javascript string is Utf-16

    var aBytes, nChr, nStrLen = sDOMStr.length, nArrLen = 0, nMapIdx, nIdx, nChrIdx;

    for (nMapIdx = 0; nMapIdx < nStrLen; nMapIdx += 1) {
      nChr = sDOMStr.charCodeAt(nMapIdx);
      nArrLen += nChr < 0x80 ? 1 : nChr < 0x800 ? 2 : nChr < 0x10000 ? 3 : nChr < 0x200000 ? 4 : nChr < 0x4000000 ? 5 : 6;
    }

    aBytes = new Uint8Array(nArrLen);

    for (nIdx = 0, nChrIdx = 0; nIdx < nArrLen; nChrIdx += 1) {
      nChr = sDOMStr.charCodeAt(nChrIdx);
      if (nChr < 128) {
        /* one byte */
        aBytes[nIdx++] = nChr;
      } else if (nChr < 0x800) {
        /* two bytes */
        aBytes[nIdx++] = 192 + (nChr >>> 6);
        aBytes[nIdx++] = 128 + (nChr & 63);
      } else if (nChr < 0x10000) {
        /* three bytes */
        aBytes[nIdx++] = 224 + (nChr >>> 12);
        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
        aBytes[nIdx++] = 128 + (nChr & 63);
      } else if (nChr < 0x200000) {
        /* four bytes */
        aBytes[nIdx++] = 240 + (nChr >>> 18);
        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
        aBytes[nIdx++] = 128 + (nChr & 63);
      } else if (nChr < 0x4000000) {
        /* five bytes */
        aBytes[nIdx++] = 248 + (nChr >>> 24);
        aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
        aBytes[nIdx++] = 128 + (nChr & 63);
      } else { /* if (nChr <= 0x7fffffff) */
        /* six bytes */
        aBytes[nIdx++] = 252 + /* (nChr >>> 32) is not possible in ECMAScript! So...: */ (nChr / 1073741824);
        aBytes[nIdx++] = 128 + (nChr >>> 24 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
        aBytes[nIdx++] = 128 + (nChr & 63);
      }
    }
    return aBytes;
  }
  toolbox.textToUtf8Uint8Array = textToUtf8Uint8Array;
  textToUint8Array = textToUtf8Uint8Array;
  toolbox.textToUint8Array = textToUint8Array;
  function textToUtf8ArrayBuffer(sDOMStr) {
    return textToUtf8Uint8Array(sDOMStr).buffer;
  }
  toolbox.textToUtf8ArrayBuffer = textToUtf8ArrayBuffer;
  textToArrayBuffer = textToUtf8ArrayBuffer;
  toolbox.textToArrayBuffer = textToArrayBuffer;

  function textToUtf8BinaryString(sDOMStr) {
    /*jslint plusplus: true, bitwise: true */
    // Assuming javascript string is Utf-16

    var bsBytes = "", nChr, nStrLen = sDOMStr.length, nChrIdx;

    for (nChrIdx = 0; nChrIdx < nStrLen; nChrIdx += 1) {
      nChr = sDOMStr.charCodeAt(nChrIdx);
      if (nChr < 128) {
        /* one byte */
        bsBytes += String.fromCharCode(nChr);
      } else if (nChr < 0x800) {
        /* two bytes */
        bsBytes += String.fromCharCode(
          192 + (nChr >>> 6),
          128 + (nChr & 63)
        );
      } else if (nChr < 0x10000) {
        /* three bytes */
        bsBytes += String.fromCharCode(
          224 + (nChr >>> 12),
          128 + (nChr >>> 6 & 63),
          128 + (nChr & 63)
        );
      } else if (nChr < 0x200000) {
        /* four bytes */
        bsBytes += String.fromCharCode(
          240 + (nChr >>> 18),
          128 + (nChr >>> 12 & 63),
          128 + (nChr >>> 6 & 63),
          128 + (nChr & 63)
        );
      } else if (nChr < 0x4000000) {
        /* five bytes */
        bsBytes += String.fromCharCode(
          248 + (nChr >>> 24),
          128 + (nChr >>> 18 & 63),
          128 + (nChr >>> 12 & 63),
          128 + (nChr >>> 6 & 63),
          128 + (nChr & 63)
        );
      } else { /* if (nChr <= 0x7fffffff) */
        /* six bytes */
        bsBytes += String.fromCharCode(
          252 + /* (nChr >>> 32) is not possible in ECMAScript! So...: */ (nChr / 1073741824),
          128 + (nChr >>> 24 & 63),
          128 + (nChr >>> 18 & 63),
          128 + (nChr >>> 12 & 63),
          128 + (nChr >>> 6 & 63),
          128 + (nChr & 63)
        );
      }
    }
    return bsBytes;
  }
  toolbox.textToUtf8BinaryString = textToUtf8BinaryString;
  textToBinaryString = textToUtf8BinaryString;
  toolbox.textToBinaryString = textToBinaryString;

  function utf8Uint8ArrayToText(aBytes) {
    /*jslint plusplus: true, bitwise: true */
    var sView = "", nPart, nLen = aBytes.length, nIdx;

    for (nIdx = 0; nIdx < nLen; ++nIdx) {
      nPart = aBytes[nIdx];
      sView += String.fromCharCode(
        nPart > 251 && nPart < 254 && nIdx + 5 < nLen ? /* six bytes */ (
          /* (nPart - 252 << 32) is not possible in ECMAScript! So...: */
          (nPart - 252) * 1073741824 + (aBytes[++nIdx] - 128 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        ) : nPart > 247 && nPart < 252 && nIdx + 4 < nLen ? /* five bytes */ (
          (nPart - 248 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        ) : nPart > 239 && nPart < 248 && nIdx + 3 < nLen ? /* four bytes */ (
          (nPart - 240 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        ) : nPart > 223 && nPart < 240 && nIdx + 2 < nLen ? /* three bytes */ (
          (nPart - 224 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        ) : nPart > 191 && nPart < 224 && nIdx + 1 < nLen ? /* two bytes */ (
          (nPart - 192 << 6) + aBytes[++nIdx] - 128
        ) : /* nPart < 127 ? */ /* one byte */ nPart
      );
    }

    return sView;
  }
  toolbox.utf8Uint8ArrayToText = utf8Uint8ArrayToText;
  uint8ArrayToText = utf8Uint8ArrayToText;
  toolbox.uint8ArrayToText = uint8ArrayToText;

  function utf8ArrayBufferToText(arrayBuffer) {
    return utf8Uint8ArrayToText(new Uint8Array(arrayBuffer));
  }
  toolbox.utf8ArrayBufferToText = utf8ArrayBufferToText;
  arrayBufferToText = utf8ArrayBufferToText;
  toolbox.arrayBufferToText = arrayBufferToText;

  function utf8BinaryStringToText(bsBytes) {
    /*jslint plusplus: true, bitwise: true */
    var sView = "", nPart, nLen = bsBytes.length, nIdx;

    for (nIdx = 0; nIdx < nLen; ++nIdx) {
      nPart = bsBytes.charCodeAt(nIdx);
      sView += String.fromCharCode(
        nPart > 251 && nPart < 254 && nIdx + 5 < nLen ? /* six bytes */ (
          /* (nPart - 252 << 32) is not possible in ECMAScript! So...: */
          (nPart - 252) * 1073741824 + (bsBytes.charCodeAt(++nIdx) - 128 << 24) + (bsBytes.charCodeAt(++nIdx) - 128 << 18) + (bsBytes.charCodeAt(++nIdx) - 128 << 12) + (bsBytes.charCodeAt(++nIdx) - 128 << 6) + bsBytes.charCodeAt(++nIdx) - 128
        ) : nPart > 247 && nPart < 252 && nIdx + 4 < nLen ? /* five bytes */ (
          (nPart - 248 << 24) + (bsBytes.charCodeAt(++nIdx) - 128 << 18) + (bsBytes.charCodeAt(++nIdx) - 128 << 12) + (bsBytes.charCodeAt(++nIdx) - 128 << 6) + bsBytes.charCodeAt(++nIdx) - 128
        ) : nPart > 239 && nPart < 248 && nIdx + 3 < nLen ? /* four bytes */ (
          (nPart - 240 << 18) + (bsBytes.charCodeAt(++nIdx) - 128 << 12) + (bsBytes.charCodeAt(++nIdx) - 128 << 6) + bsBytes.charCodeAt(++nIdx) - 128
        ) : nPart > 223 && nPart < 240 && nIdx + 2 < nLen ? /* three bytes */ (
          (nPart - 224 << 12) + (bsBytes.charCodeAt(++nIdx) - 128 << 6) + bsBytes.charCodeAt(++nIdx) - 128
        ) : nPart > 191 && nPart < 224 && nIdx + 1 < nLen ? /* two bytes */ (
          (nPart - 192 << 6) + bsBytes.charCodeAt(++nIdx) - 128
        ) : /* nPart < 127 ? */ /* one byte */ nPart
      );
    }

    return sView;
  }
  toolbox.utf8BinaryStringToText = utf8BinaryStringToText;
  binaryStringToText = utf8BinaryStringToText;
  toolbox.binaryStringToText = binaryStringToText;

  //////////////////////////////////////////////////

  function arrayBufferToBinaryString(arrayBuffer) {
    return String.fromCharCode.apply(null, new Uint8Array(arrayBuffer));
  }
  toolbox.arrayBufferToBinaryString = arrayBufferToBinaryString;

  function binaryStringToArrayBuffer(binaryString) {
    var ua = new Uint8Array(binaryString.length), i;
    for (i = 0; i < binaryString.length; i += 1) {
      ua[i] = binaryString.charCodeAt(i);
    }
    return ua.buffer;
  }
  toolbox.binaryStringToArrayBuffer = binaryStringToArrayBuffer;

  //////////////////////////////////////////////////

  toolbox.binaryStringToBase64 = btoa;
  toolbox.base64ToBinaryString = atob;

  function arrayBufferToBase64(arrayBuffer) {
    return btoa(arrayBufferToBinaryString(arrayBuffer));
  }
  toolbox.arrayBufferToBase64 = arrayBufferToBase64;

  function base64ToArrayBuffer(text) {
    return binaryStringToArrayBuffer(atob(text));
  }
  toolbox.base64ToArrayBuffer = base64ToArrayBuffer;

  function textToBase64(text) {
    return btoa(textToBinaryString(text));
  }
  toolbox.textToBase64 = textToBase64;

  function base64ToText(text) {
    return binaryStringToText(atob(text));
  }
  toolbox.base64ToText = base64ToText;

  //////////////////////////////////////////////////

  function binaryStringToHexadecimal(binaryString) {
    // This method acts like `btoa` but returns a hexadecimal encoded string
    var r = "", i;
    for (i = 0; i < binaryString.length; i += 1) {
      r += ("0" + binaryString.charCodeAt(i).toString(16)).slice(-2);
    }
    return r;
  }
  toolbox.binaryStringToHexadecimal = binaryStringToHexadecimal;

  function hexadecimalToBinaryString(text) {
    // This method acts like `atob` but parses a hexadecimal encoded string
    var r = "", i, c;
    text = text.replace(/\s/g, "");
    if (text.length % 2) {
      text += "0";
    }
    for (i = 0; i < text.length; i += 2) {
      c = (parseInt(text[i], 16) * 0x10) + parseInt(text[i + 1], 16);
      if (isNaN(c)) {
        c = new Error("String contains an invalid character");
        c.name = "InvalidCharacterError";
        c.code = 5;
        throw c;
      }
      r += String.fromCharCode(c);
    }
    return r;
  }
  toolbox.hexadecimalToBinaryString = hexadecimalToBinaryString;

  function arrayBufferToHexadecimal(arrayBuffer) {
    return binaryStringToHexadecimal(arrayBufferToBinaryString(arrayBuffer));
  }
  toolbox.arrayBufferToHexadecimal = arrayBufferToHexadecimal;

  function hexadecimalToArrayBuffer(text) {
    return binaryStringToArrayBuffer(hexadecimalToBinaryString(text));
  }
  toolbox.hexadecimalToArrayBuffer = hexadecimalToArrayBuffer;

  function textToHexadecimal(text) {
    return binaryStringToHexadecimal(textToBinaryString(text));
  }
  toolbox.textToHexadecimal = textToHexadecimal;

  function hexadecimalToText(text) {
    return binaryStringToText(hexadecimalToBinaryString(text));
  }
  toolbox.hexadecimalToText = hexadecimalToText;

  //////////////////////////////////////////////////

  function normalizePath(path) {
    /**
     *     normalizePath(path): string
     *
     * Returns a normalized version of `path` taking care of ".." and "." parts. It
     * removes all useless "/" but keeps the trailing one.
     *
     * Examples:
     *
     *     // normalize path and remove trailing slashes
     *     path = normalizePath(path + "/.")
     *     // normalize path in a chroot
     *     realpath = CHROOT_REALPATH + normalizePath("/" + path)
     *
     * @param  path {String} The path to normalize
     * @return {String} The normalized path
     */
    if (path === "." || path === "") { return "."; }
    if (path === "..") { return ".."; }
    var split = path.split("/"), skip = 0, i = split.length - 1, res = "", sep = "";
    if (i > 0) {
      if (split[i] === "") {
        sep = "/";
        i -= 1;
      }
    }
    while (i > 0) {
      if (split[i] === "..") {
        skip += 1;
      } else if (split[i] !== "." && split[i] !== "") {
        if (skip > 0) {
          skip -= 1;
        } else {
          res =  split[i] + sep + res;
          sep = "/";
        }
      }
      i -= 1;
    }
    if (split[0] === "") {
      res = "/" + res;
    } else {
      if (split[0] === "..") {
        skip += 1;
      } else if (split[0] !== ".") {
        if (skip > 0) {
          skip -= 1;
        } else {
          res = split[0] + sep + res;
        }
      }
      while (skip > 0) {
        res = ".." + sep + res;
        sep = "/";
        skip -= 1;
      }
    }
    if (res === "") { return "." + sep; }
    return res;
  }
  toolbox.normalizePath = normalizePath;

  function resolvePath(path1, path2) {
    // Resolve path like unix file systems
    // Ex:
    //   resolvePath("/ab/cd/ef", "gh");
    //   -> "/ab/cd/ef/gh"
    //   resolvePath("/ab/cd/ef", "../gh");
    //   -> "/ab/cd/gh"
    //   resolvePath("/ab/cd/ef", "/gh");
    //   -> "/gh"
    if (path2[0] === "/") {
      return normalizePath(path2);
    }
    return normalizePath(path1 + "/" + path2);
  }
  toolbox.resolvePath = resolvePath;

  //////////////////////////////////////////////////

  urlParserRegExp = new RegExp("^" +
    "(?:" +
      "(?:" +
        "(" + uriProtocolStringRegExp + ")?" + // 1 absolute url protocol
        "//" +
        "(?:" +
          "(" + urlUserPasswordCharsetStringRegExp + "+)" + // 2 absolute url user
          "(?::(" + urlUserPasswordCharsetStringRegExp + "+))?" + // 3 absolute url password
        "@)?" +
        "(" + urlHostNameStringRegExp + ")" + // 4 absolute url hostname
        "(?::(" + urlPortStringRegExp + "))?" + // 5 absolute url port
      ")?" +
      "(/" + urlPathNameCharsetStringRegExp + "*)?" + // 6 absolute url pathname
    "|" +
      "(" + urlPathNameCharsetStringRegExp + "+)?" + // 7 relative url pathname
    ")" +
    "(\\?" + urlQueryCharsetStringRegExp + "+)?" + // 8 absolute url query search
    "(#" + urlHashCharsetStringRegExp + "+)?" + // 9 absolute url hash
    "$");

  function parseURL(url) {
    // {
    //   href: "http://user:pass@host.com:8080/p/a/t/h?query=string#hash"
    //   protocol: "http:"
    //   user: "user"
    //   password: "pass"
    //   hostname: "host.com"
    //   port: 8080
    //   pathname: "/p/a/t/h"
    //   query: {"query": "string"}
    //   search: "?query=string"
    //   hash: "#hash"
    // }
    var parsed = urlParserRegExp.exec(url.replace(/ /g, "%20")), result = {"input": url};
    if (!parsed) { return null; }
    result.match = parsed[0];
    result.href = parsed[0];
    if (parsed[1] !== undefined) { result.protocol = parsed[1]; }
    if (parsed[2] !== undefined) { result.user = parsed[2]; }
    if (parsed[3] !== undefined) { result.password = parsed[3]; }
    if (parsed[4] !== undefined) { result.hostname = parsed[4]; }
    if (parsed[5] !== undefined) { result.port = parseInt(parsed[5], 10); }
    if (parsed[6] !== undefined) { result.pathname = parsed[6]; }
    if (parsed[7] !== undefined) { result.pathname = parsed[7]; }
    if (parsed[8] !== undefined) { result.search = parsed[8]; }
    if (parsed[9] !== undefined) { result.hash = parsed[9]; }
    if (result.search !== undefined) {
      result.query = result.search.slice(1).split("&").reduce(function (query, value) {
        var key = value.split("=");
        value = key.slice(1).join("=");
        query[decodeURIComponent(key[0])] = decodeURIComponent(value);
        return query;
      }, {});
    }
    return result;
  }
  toolbox.parseURL = parseURL;

  function makeURL(param) {
    // param = {
    //   protocol: "http:"
    //   user: "user"
    //   password: "pass"
    //   hostname: "host.com"
    //   port: 8080
    //   pathname: "/p/a/t/h"
    //   query: {"query": "string"}
    //   search: "?query=string" // ignored if query property is set
    //   hash: "#hash"
    // } -> "http://user:pass@host.com:8080/p/a/t/h?query=string#hash"
    var result = "";
    if (param.hostname) {
      if (param.protocol) {
        result += param.protocol;
        if (result[result.length - 1] !== ":") {
          result += ":";
        }
      }
      result += "//";
      if (param.user) {
        result += param.user;
        if (param.password) {
          result += ":" + param.password;
        }
        result += "@";
      }
      result += param.hostname;
      if (param.port) {
        result += ":" + param.port;
      }
    }
    if (param.pathname) {
      if (param.pathname[0] !== "/" && param.hostname) {
        result += "/";
      }
      result += param.pathname;
    }
    if (param.query) {
      result += "?" + Object.keys(param.query).map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(param.query[key]);
      }).join("&");
    } else if (param.search) {
      if (param.search[0] !== "?") {
        result += "?";
      }
      result += param.search;
    }
    if (param.hash) {
      if (param.hash[0] !== "#") {
        result += "#";
      }
      result += param.hash;
    }
    return result;
  }
  toolbox.makeURL = makeURL;

  function normalizeURLPathname(path) {
    /**
     *     normalizeURLPathname(path): string
     *
     * Returns a normalized version of `path` taking care of ".." and "." parts.
     *
     * @param  path {String} The URL pathname to normalize
     * @return {String} The normalized URL pathname
     */
    if (path === "." || path === "") { return ""; }
    if (path === "..") { return ".."; }
    var split = path.split("/"), skip = 0, i = split.length - 1, res = "", sep = "";
    if (split[i] === ".") {
      sep = "/";
      i -= 1;
    } else if (split[i] === "..") {
      sep = "/";
    }
    while (i > 0) {
      if (split[i] === "..") {
        skip += 1;
      } else if (split[i] !== ".") {
        if (skip > 0) {
          skip -= 1;
        } else {
          res = split[i] + sep + res;
          sep = "/";
        }
      }
      i -= 1;
    }
    if (split[0] === "") {
      res = "/" + res;
    } else {
      if (split[0] === "..") {
        skip += 1;
      } else if (split[0] !== ".") {
        if (skip > 0) {
          skip -= 1;
        } else {
          res = split[0] + sep + res;
        }
      }
      while (skip > 0) {
        res = ".." + sep + res;
        sep = "/";
        skip -= 1;
      }
    }
    return res;
  }
  toolbox.normalizeURLPathname = normalizeURLPathname;

  function resolveURLPathname(pathname1, pathname2) {
    if (pathname2[0] === "/") {
      return normalizeURLPathname(pathname2);
    }
    /*jslint regexp: true */
    return normalizeURLPathname(pathname1.replace(/[^\/]+$/, '') + pathname2);
  }
  toolbox.resolveURLPathname = resolveURLPathname;

  function resolveURL(fromURL, toURL) {
    // Acts like browser URL resolution. For instance when you click on an A tag,
    // the href attribute value is resolved with the current URL.
    // Ex:
    //   resolveURL("http://ab.cd/ef/gh/ij/kl?mn=op#qr", "/st");
    //   -> "http://ab.cd/st"
    //   resolveURL("http://ab.cd/ef/gh/ij/kl?mn=op#qr", "//st.uv/");
    //   -> "http://st.uv/"
    /*jslint regexp: true */
    fromURL = parseURL(fromURL);
    toURL = parseURL(toURL);
    toURL.query = null;
    if (toURL.protocol) {
      return toURL.href;
    }
    if (toURL.hostname) {
      return (fromURL.protocol || "") + toURL.href;
    }
    toURL.protocol = fromURL.protocol;
    toURL.user = fromURL.user;
    toURL.password = fromURL.password;
    toURL.hostname = fromURL.hostname;
    toURL.port = fromURL.port;
    if (toURL.pathname) {
      if (toURL.pathname[0] === "/") {
        return makeURL(toURL);
      }
      toURL.pathname = resolveURLPathname(fromURL.pathname || "", toURL.pathname);
      return makeURL(toURL);
    }
    toURL.pathname = fromURL.pathname;
    if (toURL.search) {
      return makeURL(toURL);
    }
    toURL.search = fromURL.search;
    if (toURL.hash) {
      return makeURL(toURL);
    }
    return fromURL.href;
  }
  toolbox.resolveURL = resolveURL;

  //////////////////////////////////////////////////

  /*jslint regexp: true */
  localstorageURIParserRegExp = /^(localstorage:)?(.*)$/;
  fileURIParserRegExp = /^(?:(file:\/\/)[^\/]*)?(.*)$/;
  /*jslint regexp: false */

  function resolveURLURI(uri, link) {
    if (/^[a-z]+:/.test(link)) { return link; }
    return resolveURL(uri, link);
  }
  toolbox.resolveURLURI = resolveURLURI;

  toolbox.resolveHttpURI = resolveURLURI;
  toolbox.resolveHttpsURI = resolveURLURI;
  toolbox.resolveDavURI = resolveURLURI;
  toolbox.resolveDavsURI = resolveURLURI;
  toolbox.resolveWebdavURI = resolveURLURI;
  toolbox.resolveWebdavsURI = resolveURLURI;

  function resolveLocalstorageURI(uri, link) {
    if (/^[a-z]+:/.test(link)) { return link; }
    uri = localstorageURIParserRegExp.exec(uri);
    return (uri[1] || "") + resolveURLPathname(
      uri[2],
      localstorageURIParserRegExp.exec(link)[2]
    );
  }
  toolbox.resolveLocalstorageURI = resolveLocalstorageURI;

  function resolveFileURI(uri, link) {
    if (/^[a-z]+:/.test(link)) { return link; }
    uri = fileURIParserRegExp.exec(uri);
    return (uri[1] || "") + resolveURLPathname(
      uri[2],
      fileURIParserRegExp.exec(link)[2]
    );
  }
  toolbox.resolveFileURI = resolveFileURI;

  function resolveDataURI(uri, link) {
    /*jslint unparam: true */
    if (/^[a-z]+:/.test(link)) { return link; }
    return "data:,"; // TODO return null? throw?
  }
  toolbox.resolveDataURI = resolveDataURI;

  //////////////////////////////////////////////////

  function parseContentType(contentType) {
    // Returns an object containing all content-type information
    // Ex:
    // {
    //   input: "text/plain;charset=utf-8;base64,ABCDEFGH", // is the actual `contentType` parameter
    //   match: "text/plain;charset=utf-8;base64,", // is what the parser matched
    //   mimeType: "text/plain", // is the mimetype
    //   args: { // is the content type parameters
    //     charset: "utf-8",
    //     base64: ""
    //   }
    // }
    /*jslint regexp: true, ass: true */
    var obj = {match: "", input: contentType, args: {}}, tmp;
    contentType = contentType.replace(/^\s*(?:([a-z]+\/[a-zA-Z_\-\.\+]+)|[^;,]*)\s*(?:;|,|$)/, function (match, group1) {
      if (group1) {
        obj.match += match;
        obj.mimeType = group1;
      }
      return "";
    });
    function matcher(match, group1, group2) {
      if (group1) {
        obj.match += match;
        obj.args[group1] = group2 || "";
      }
      return "";
    }
    while ((tmp = contentType.replace(/^\s*(?:([a-z0-9]+)(?:\s*=(?:\s*([a-z0-9\+\/_\-\.]+))?)?|[^;,])*\s*(?:;|,|$)/i, matcher)) !== contentType) {
      contentType = tmp;
    }
    return obj;
  }
  toolbox.parseContentType = parseContentType;

  //////////////////////////////////////////////////

  function parseDataURIAsBlob(dataURI) {
    // Parses a data uri to a blob. As browser acts differently depending on
    // security and other configurations, this method does not return a text
    // but a blob, which can be converted later as text if necessary.
    // Ex:
    //   "data:application/octet-stream;base64,ABCDEFGH"
    //   -> Blob {size: 6, type: "application/octet-stream"}
    /*jslint regexp: true */
    if (dataURI.slice(0, 5) !== "data:") {
      return null;
    }
    var mimetype, charset, base64, data;
    data = dataURI.slice(5).replace(/^[^,]*,/, function (match) {
      mimetype = match;
      return "";
    });
    if (mimetype === undefined) { return null; }
    mimetype = parseContentType(mimetype);
    charset = mimetype.args.charset;
    base64 = mimetype.args.base64;
    mimetype = mimetype.mimeType;
    data = decodeURIComponent(data);
    if (base64 !== undefined) {
      try {
        data = atob(data);
      } catch (ignored) {
        return null;
      }
      data = binaryStringToArrayBuffer(data);
    }
    if (!mimetype) {
      mimetype = "text/plain";
      charset = ""; // = "US-ASCII";
    }
    return new Blob([data], {type: mimetype + (charset ? ";charset=" + charset : "")});
  }
  toolbox.parseDataURIAsBlob = parseDataURIAsBlob;

  //////////////////////////////////////////////////

  function htmlToLinks(html) {
    // [ { "link": "<URL>",
    //     "type": "<tagName> <attributeName>" }, ...]
    var result = [], i, el, tmp, row,
      elements = new DOMParser().parseFromString(html, "text/html").querySelectorAll("*");
    for (i = 0; i < elements.length; i += 1) {
      el = elements[i];
      tmp = el.getAttribute("href");
      if (tmp) {
        row = {
          link: tmp,
          type: el.tagName + " href"
        };
        tmp = el.getAttribute("rel");
        if (tmp) { row.rel = tmp; }
        result.push(row);
      }
      tmp = el.getAttribute("src");
      if (tmp) {
        result.push({
          link: tmp,
          type: el.tagName + " src"
        });
      }
      if (el.tagName === "HTML") {
        tmp = el.getAttribute("manifest");
        if (tmp) {
          result.push({
            link: tmp,
            type: "HTML manifest"
          });
        }
      }
    }
    return result;
  }
  toolbox.htmlToLinks = htmlToLinks;

  function linksToHTMLElement(links) {
    var i, result = document.createElement("p"), a;
    for (i = 0; i < links.length; i += 1) {
      if (links[i].type) {
        result.appendChild(document.createTextNode(links[i].type + ": "));
      }
      a = document.createElement("a");
      a.textContent = links[i].text || links[i].link;
      a.href = links[i].link;
      result.appendChild(a);
      result.appendChild(document.createElement("br"));
    }
    return result;
  }
  toolbox.linksToHTMLElement = linksToHTMLElement;

  //////////////////////////////////////////////////

  function range(start, end, step, callback) {
    // function range(start, end, callback)
    // function range(end, callback)
    if (arguments.length > 3) {
      while (start < end) {
        callback(start);
        start += step;
      }
    } else if (arguments.length === 3) {
      while (start < end) {
        step(start);
        start += 1;
      }
    } else if (arguments.length === 2) {
      step = 0;
      while (step < start) {
        end(step);
        step += 1;
      }
    } else {
      throw new Error("range() needs at least two arguments");
    }
  }
  toolbox.range = range;

  //////////////////////////////////////////////////

  function downloadAs(filename, data, mimetype) {
    /**
     * Allows the user to download `data` as a file which name is defined by
     * `filename`. The `mimetype` will help the browser to choose the associated
     * application to open with.
     *
     * @param  {String} filename The file name.
     * @param  {Any} data The data to download.
     * @param  {String} mimetype The data type.
     */
    data = URL.createObjectURL(new Blob([data], {"type": (mimetype || (data && data.type)) || "application/octet-stream"}));
    var a = document.createElement("a");
    if (a.download !== undefined) {
      a.download = filename;
      a.href = data;
      //a.textContent = 'Downloading...';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      open(data);
    }
  }
  toolbox.downloadAs = downloadAs;

  //////////////////////////////////////////////////

  function xmlHttpRequestHeadersToKeyValue(sHeaders) {
    // sHeaders ->
    //   Server:   SimpleHTTP/0.6 Python/3.4.1\r\n
    //   Date: Wed, 04 Jun 2014 14:06:57 GMT   \r\n
    //   Value: hello\r\n     guys  \r\n
    //   Content-Type: application/x-silverlight\r\n
    //   Content-Length: 11240\r\n
    //   Last-Modified: Mon, 03 Dec 2012 23:51:07 GMT\r\n
    //   X-Cache: HIT via me\r\n
    //   X-Cache: HIT via other\r\n
    // Returns ->
    //   { "Server": "SimpleHTTP/0.6 Python/3.4.1",
    //     "Date": "Wed, 04 Jun 2014 14:06:57 GMT",
    //     "Value": "hello guys",
    //     "Content-Type": "application/x-silverlight",
    //     "Content-Length": "11240",
    //     "Last-Modified": "Mon, 03 Dec 2012 23:51:07 GMT",
    //     "X-Cache": "HIT via me, HIT via other" }

    /*jslint regexp: true */
    var result = {}, key, value = "";
    sHeaders.split("\r\n").forEach(function (line) {
      if (line[0] === " " || line[0] === "\t") {
        value += " " + line.replace(/^\s*/, "").replace(/\s*$/, "");
      } else {
        if (key) {
          if (result[key]) {
            result[key] += ", " + value;
          } else {
            result[key] = value;
          }
        }
        key = /^([^:]+)\s*:\s*(.*)$/.exec(line);
        if (key) {
          value = key[2].replace(/\s*$/, "");
          key = key[1];
        }
      }
    });
    return result;
  }
  toolbox.xmlHttpRequestHeadersToKeyValue = xmlHttpRequestHeadersToKeyValue;

  //////////////////////////////////////////////////

  function Deferred() {
    var it = this;
    it.promise = new Promise(function (resolve, reject) {
      it.resolve = resolve;
      it.reject = reject;
    });
  }
  toolbox.Deferred = Deferred;

  function CancellableDeferred() {
    // Simple example:
    //   var cd = new CancellableDeferred()
    //   cd.oncancel = function () { cd.reject("CANCELLED"); };
    //   ...do asynchronous code here...
    //   return cd.promise;

    var it = this;
    it.promise = new Promise(function (resolve, reject) {
      it.resolve = resolve;
      it.reject = reject;
    });
    it.promise.cancel = function () {
      // just send a cancel signal

      try { it.oncancel(); } catch (ignore) {}
      return this;
    };
  }
  toolbox.CancellableDeferred = CancellableDeferred;

  //////////////////////////////////////////////////

  function CancellablePromise(executor, canceller) {
    this._canceller = canceller;
    this._promise = new Promise(executor);
  }

  CancellablePromise.prototype.then = function () {
    return this._promise.then.apply(this._promise, arguments);
  };

  CancellablePromise.prototype["catch"] = function () {
    return this._promise["catch"].apply(this._promise, arguments);
  };

  CancellablePromise.prototype.cancel = function () {
    // just send a cancel signal

    try { this._canceller(); } catch (ignore) {}
    // if not function throw new Error("Cannot cancel this promise."); ?
    return this;
  };

  CancellablePromise.all = function (promises) {
    /**
     *     all(promises): Promise< promises_fulfilment_values >
     *     all(promises): Promise< one_rejected_reason >
     *
     * Produces a promise that is resolved when all the given `promises` are
     * fulfilled. The fulfillment value is an array of each of the fulfillment
     * values of the promise array.
     *
     * If one of the promises is rejected, the `all` promise will be rejected with
     * the same rejected reason, and the remaining unresolved promises recieve a
     * cancel signal.
     *
     * @param  {Array} promises An array of promises
     * @return {Promise} A promise
     */
    var length = promises.length, cancellableDeferred, i, count, results, ended;

    if (length === 0) {
      return Promise.resolve([]);
    }

    function onCancel() {
      if (ended) { return; }
      delete cancellableDeferred.oncancel;
      var j;
      for (j = 0; j < promises.length; j += 1) {
        if (typeof promises[j].cancel === "function") {
          try { promises[j].cancel(); } catch (ignore) {}
        }
      }
    }
    function resolver(i) {
      return function (value) {
        count += 1;
        results[i] = value;
        if (count !== length) { return; }
        delete cancellableDeferred.oncancel;
        cancellableDeferred.resolve(results);
      };
    }
    function rejecter(reason) {
      if (ended) { return; }
      onCancel();
      ended = true;
      cancellableDeferred.reject(reason);
    }

    cancellableDeferred = new CancellableDeferred();
    cancellableDeferred.oncancel = onCancel;
    count = 0;
    results = [];
    for (i = 0; i < length; i += 1) {
      promises[i].then(resolver(i), rejecter);
    }
    return cancellableDeferred.promise;
  };

  CancellablePromise.race = function (promises) {
    /**
     *     race(promises): promise< first_value >
     *
     * Produces a promise that is fulfilled when any one of the given promises is
     * fulfilled. As soon as one of the promises is resolved, whether by being
     * fulfilled or rejected, all the promises receive a cancel signal.
     *
     * @param  {Array} promises An array of promises
     * @return {Promise} A promise
     */
    var length = promises.length, cancellableDeferred, i, ended;

    function onCancel() {
      if (ended) { return; }
      delete cancellableDeferred.oncancel;
      var j;
      for (j = 0; j < promises.length; j += 1) {
        if (typeof promises[j].cancel === "function") {
          promises[j].cancel();
        }
      }
    }
    function resolver(value) {
      if (ended) { return; }
      onCancel();
      cancellableDeferred.resolve(value);
      ended = true;
    }
    function rejecter(reason) {
      if (ended) { return; }
      onCancel();
      cancellableDeferred.reject(reason);
      ended = true;
    }
    cancellableDeferred = new CancellableDeferred();
    cancellableDeferred.oncancel = onCancel;
    for (i = 0; i < length; i += 1) {
      promises[i].then(resolver, rejecter);
    }
  };

  CancellablePromise.spawn = function (generator) {
    /**
     *     spawn(generator): CancellablePromise< returned_value >
     *
     * Use generator function to do asynchronous operations sequentialy using
     * `yield` operator.
     *
     *     spawn(function* () {
     *       try {
     *         var config = yield getConfig();
     *         config.enableSomething = true;
     *         yield sleep(1000);
     *         yield putConfig(config);
     *       } catch (e) {
     *         console.error(e);
     *       }
     *     });
     *
     * @param  {Function} generator A generator function.
     * @return {CancellablePromise} A new cancellable promise
     */
    var promise, cancelled, cancellableDeferred = new CancellableDeferred(), g = generator(), prev, next = {};
    function onCancel() {
      cancelled = true;
      if (promise && typeof promise.cancel === "function") {
        try { promise.cancel(); } catch (ignore) {}
      }
    }
    cancellableDeferred.oncancel = onCancel;
    function rec(method) {
      if (cancelled) {
        return cancellableDeferred.reject(new Error("Cancelled"));
      }
      try {
        next = g[method](prev);
      } catch (e) {
        return cancellableDeferred.reject(e);
      }
      if (next.done) {
        return cancellableDeferred.resolve(next.value);
      }
      promise = next.value;
      if (!promise || typeof promise.then !== "function") {
        // The value is not a thenable. However, the user used `yield`
        // anyway. It means he wants to left hand to another process.
        promise = new Promise.resolve(promise);
      }
      return promise.then(function (value) {
        prev = value;
        rec("next");
      }, function (reason) {
        prev = reason;
        rec("throw");
      });
    }
    rec("next");
    return cancellableDeferred.promise;
  };

  CancellablePromise.sequence = function (array) {
    /**
     *     sequence(thenArray): CancellablePromise< returned_value >
     *
     * An alternative to `CancellablePromise.spawn`, but instead of using a
     * generator function, it uses an array of function like in then chains.
     * This function works with old ECMAScript version.
     *
     *     var config;
     *     sequence([function () {
     *       return getConfig();
     *     }, function (_config) {
     *       config = _config;
     *       config.enableSomething = true;
     *       return sleep(1000);
     *     }, function () {
     *       return putConfig(config);
     *     }, [null, function (e) {
     *       console.error(e);
     *     }]]);
     *
     * @param  {Array} thenArray An array of function.
     * @return {CancellablePromise} A new cancellable promise
     */
    return CancellablePromise.spawn(function () {
      var i = 0, g;
      function exec(f, value) {
        try {
          value = f(value);
          if (i === array.length) {
            return {"done": true, "value": value};
          }
          return {"value": value};
        } catch (e) {
          return g["throw"](e);
        }
      }
      g = {
        "next": function (value) {
          var f;
          while (i < array.length) {
            if (Array.isArray(array[i])) {
              f = array[i][0];
            } else {
              f = array[i];
            }
            if (typeof f === "function") {
              i += 1;
              return exec(f, value);
            }
            i += 1;
          }
          return {"done": true, "value": value};
        },
        "throw": function (value) {
          var f;
          while (i < array.length) {
            if (Array.isArray(array[i])) {
              f = array[i][1];
            }
            if (typeof f === "function") {
              i += 1;
              return exec(f, value);
            }
            i += 1;
          }
          throw value;
        }
      };
      return g;
    });
  };

  toolbox.CancellablePromise = CancellablePromise;

  //////////////////////////////////////////////////

  function CancellableChain(promise, onDone, onFail, previous) {
    // Can cancel promises with `promise.cancel();`.
    var it = this;
    if (!promise || typeof promise.then !== "function") {
      if (typeof onDone === "function") {
        promise = Promise.resolve(promise);
      } else {
        it._r = Promise.resolve(promise);
        return;
      }
    }
    function _onDone(v) {
      delete it._cf;
      delete it._previous;
      if (it._cancelled) { return; }
      if (typeof onDone !== "function") {
        return v;
      }
      it._value = onDone(v);
      if (it._cancelled) {
        if (it._value && typeof it._value.then === "function" && typeof it._value.cancel === "function") {
          try { it._value.cancel(); } catch (ignore) {}
        }
      }
      return it._value;
    }
    function _onFail(v) {
      delete it._cf;
      delete it._previous;
      if (it._cancelled) { return; }
      if (typeof onFail !== "function") {
        return Promise.reject(v);
      }
      it._value = onFail(v);
      if (it._cancelled) {
        if (it._value && typeof it._value.then === "function" && typeof it._value.cancel === "function") {
          try { it._value.cancel(); } catch (ignore) {}
        }
      }
      return it._value;
    }
    it._previous = previous;
    it._c = new Promise(function (d, f) {
      /*jslint unparam: true */
      it._cf = f;
    });
    it._r = Promise.race([it._c, promise.then(_onDone, _onFail)]);
  }
  CancellableChain.prototype.then = function (onDone, onFail) {
    return new CancellableChain(this._r, onDone, onFail, this);
  };
  CancellableChain.prototype.catch = function (onFail) {
    return this.then(null, onFail);
  };
  CancellableChain.prototype.cancel = function () {
    this._cancelled = true;
    if (typeof this._cf === "function") {
      try { this._cf(new Error("Cancelled")); } catch (ignore) {}
    }
    if (this._value && typeof this._value.then === "function" && typeof this._value.cancel === "function") {
      try { this._value.cancel(); } catch (ignore) {}
    }
    if (this._previous && typeof this._previous.then === "function" && typeof this._previous.cancel === "function") {
      try { this._previous.cancel(); } catch (ignore) {}
    }
  };
  CancellableChain.prototype.detach = function () {
    var p = this.then();
    p.cancel = null;
    return p;
    // return new CancellableChain(this._r);
  };
  toolbox.CancellableChain = CancellableChain;

  //////////////////////////////////////////////////

  function ExtendedCancellableChain() {
    CancellableChain.apply(this, arguments);
  }
  ExtendedCancellableChain.prototype = Object.create(CancellableChain.prototype);
  ExtendedCancellableChain.prototype.then = function (onDone, onFail) {
    return new ExtendedCancellableChain(this._r, onDone, onFail, this);
  };
  toolbox.ExtendedCancellableChain = ExtendedCancellableChain;

  function readBlobAsText(blob) {
    var d = new CancellableDeferred(), fr = new FileReader();
    fr.onload = function (ev) { return d.resolve(ev.target.result); };
    fr.onerror = function () { return d.reject(new Error("Unable to read blob as text")); };
    fr.onabort = function () { return d.reject(new Error("Cancelled")); };
    d.oncancel = function () { fr.abort(); };
    fr.readAsText(blob);
    return d.promise;
  }
  toolbox.readBlobAsText = readBlobAsText;

  function readBlobAsArrayBuffer(blob) {
    var d = new CancellableDeferred(), fr = new FileReader();
    fr.onload = function (ev) { return d.resolve(ev.target.result); };
    fr.onerror = function () { return d.reject(new Error("Unable to read blob as ArrayBuffer")); };
    fr.onabort = function () { return d.reject(new Error("Cancelled")); };
    d.oncancel = function () { fr.abort(); };
    fr.readAsArrayBuffer(blob);
    return d.promise;
  }
  toolbox.readBlobAsArrayBuffer = readBlobAsArrayBuffer;

  //////////////////////////
  // Revisited statements //
  //////////////////////////

  ExtendedCancellableChain.prototype.while = function (tester, loop) {
    var ecc = new ExtendedCancellableChain();
    return this.then(function (input) {
      var d = new CancellableDeferred(), cancelled, currentPromise;
      d.oncancel = function () {
        cancelled = true;
        currentPromise.cancel(); // can throw, don't care
      };
      function cancel() {
        d.reject(new Error("Cancelled"));
      }
      function wrappedTester() {
        if (cancelled) { return cancel(); }
        return tester(input);
      }
      function wrappedLoop() {
        if (cancelled) { return cancel(); }
        return loop(input);
      }
      function recWithLoop() {
        currentPromise = ecc.then(wrappedTester).then(function (result) {
          if (result) { return ecc.then(wrappedLoop).then(recWithLoop); }
          d.resolve();
        }).then(null, d.reject);
      }
      function recWithoutLoop() {
        currentPromise = ecc.then(wrappedTester).then(function (result) {
          if (result) { return recWithoutLoop(); }
          d.resolve();
        }).then(null, d.reject);
      }
      if (typeof loop === "function") {
        recWithLoop();
      } else {
        recWithoutLoop();
      }
      return d.promise;
    });
  };

  ExtendedCancellableChain.prototype.loop = function (callback) {
    // Infinite loop until error
    return this.while(function () {
      return true;
    }, callback);
  };

  ExtendedCancellableChain.prototype.ifelse = function (tester, onOk, onKo) {
    var input;
    return this.then(function (_input) {
      input = _input;
      return tester(input);
    }).then(function (result) {
      if (result) {
        if (typeof onOk === "function") {
          return onOk(input);
        }
      } else {
        if (typeof onKo === "function") {
          return onKo(input);
        }
      }
    });
  };

  ExtendedCancellableChain.prototype.if = function (tester, callback) {
    return this.ifelse(tester, callback);
  };

  // TODO forRange

  //////////////////////////////////////////
  // Revisited object getters and setters //
  //////////////////////////////////////////

  ExtendedCancellableChain.prototype.get = function (key, _default) {
    return this.then(function (object) {
      if (Array.isArray(key)) {
        key.forEach(function (key) {
          object = object[key];
        });
        if (object === undefined) { return _default; }
        return object;
      }
      object = object[key];
      if (object === undefined) { return _default; }
      return object;
    });
  };

  ExtendedCancellableChain.prototype.getFrom = function (object, key, _default) {
    return this.then(function () {
      if (Array.isArray(key)) {
        key.forEach(function (key) {
          object = object[key];
        });
        if (object === undefined) { return _default; }
        return object;
      }
      object = object[key];
      if (object === undefined) { return _default; }
      return object;
    });
  };

  ExtendedCancellableChain.prototype.set = function (key, value) {
    return this.then(function (object) {
      if (Array.isArray(key)) {
        key.slice(0, -1).reduce(function (prev, key) {
          return prev[key];
        }, object)[key[key.length - 1]] = value;
      }
      object[key] = value;
      return object;
    });
  };

  ExtendedCancellableChain.prototype.setTo = function (object, key) {
    return this.then(function (value) {
      if (Array.isArray(key)) {
        key.slice(0, -1).reduce(function (prev, key) {
          return prev[key];
        }, object)[key[key.length - 1]] = value;
      }
      object[key] = value;
      return object;
    });
  };

  ExtendedCancellableChain.prototype.setDefaults = function (defaults) {
    return this.then(function (object) {
      Object.keys(defaults).forEach(function (key) {
        if (object[key] === undefined) {
          object[key] = defaults[key];
        }
      });
      return object;
    });
  };

  ExtendedCancellableChain.prototype.setDefaultsTo = function (object) {
    return this.then(function (defaults) {
      Object.keys(defaults).forEach(function (key) {
        if (object[key] === undefined) {
          object[key] = defaults[key];
        }
      });
      return object;
    });
  };


  ///////////////////////
  // Revisited methods //
  ///////////////////////

  ExtendedCancellableChain.prototype.split = function (separator, limit) {
    return this.then(function (input) {
      return input.split(separator, limit);
    });
  };

  ExtendedCancellableChain.prototype.slice = function (a, b, c) {
    return this.then(function (input) {
      return input.slice(a, b, c);
    });
  };

  ExtendedCancellableChain.prototype.join = function (separator) {
    return this.then(function (input) {
      return input.join(separator);
    });
  };

  ExtendedCancellableChain.prototype.sort = function (compareFn) {
    return this.then(function (input) {
      return input.sort(compareFn);
    });
  };

  ExtendedCancellableChain.prototype.replace = function (pattern, by) {
    return this.then(function (input) {
      return input.replace(pattern, by);
    });
  };

  ExtendedCancellableChain.prototype.toSlices = function (size) {
    return this.then(function (value) {
      var l = value.length || value.size || 0, slices = [], i;
      for (i = size; i < l; i += size) {
        slices.push(value.slice(i - size, i));
      }
      if (i >= l) { slices.push(value.slice(i - size, l)); }
      return slices;
    });
  };

  ExtendedCancellableChain.prototype.forEach = function (callback) {
    var ecc = new ExtendedCancellableChain();
    return this.then(function (array) {
      if (array.length === 0) { return; }
      var i = 0;
      function wrappedCallback() { return callback(array[i], i, array); }
      function afterCallback() {
        i += 1;
        return i < array.length;
      }
      return ecc.while(function () {
        return ecc.then(wrappedCallback).then(afterCallback);
      }).then(function () { return array; });
    });
  };

  ExtendedCancellableChain.prototype.reduce = function (callback, prev) {
    var ecc = new ExtendedCancellableChain(), args = arguments;
    return this.then(function (array) {
      if (array.length === 0) { return; }
      var i = 0;
      if (args.length < 2) {
        i += 1;
        prev = array[0];
        if (array.length === 1) { return; }
      }
      function wrappedCallback() { return callback(prev, array[i], i, array); }
      function afterCallback(v) {
        prev = v;
        i += 1;
        return i < array.length;
      }
      return ecc.while(function () {
        return ecc.then(wrappedCallback).then(afterCallback);
      }).then(function () { return prev; });
    });
  };

  ExtendedCancellableChain.prototype.map = function (callback) {
    var ecc = new ExtendedCancellableChain(), newArray = [];
    return this.then(function (array) {
      if (array.length === 0) { return newArray; }
      var i = 0;
      function wrappedCallback() { return callback(array[i], i, array); }
      function afterCallback(value) {
        newArray[i] = value;
        i += 1;
        return i < array.length;
      }
      return ecc.while(function () {
        return ecc.then(wrappedCallback).then(afterCallback);
      }).then(function () { return newArray; });
    });
  };

  ExtendedCancellableChain.prototype.remap = function (callback) {
    var ecc = new ExtendedCancellableChain(), _array;
    return this.then(function (array) {
      if (array.length === 0) { return array; }
      _array = array;
      var i = 0;
      function wrappedCallback() { return callback(array[i], i, array); }
      function afterCallback(value) {
        array[i] = value;
        i += 1;
        return i < array.length;
      }
      return ecc.while(function () {
        return ecc.then(wrappedCallback).then(afterCallback);
      }).then(function () { return _array; });
    });
  };

  ExtendedCancellableChain.prototype.filter = function (tester, reverse) {
    // tester can be an object with a `test` method, a function or a simple value
    var _tester = function (value) { return value === tester; },
      newArray = [],
      ecc = new ExtendedCancellableChain();
    reverse = (reverse && reverse.reverse) || reverse === "reverse";
    if (tester) {
      if (typeof tester.test === "function") {
        _tester = function (value) { return tester.test(value); };
      } else if (typeof tester === "function") {
        _tester = tester;
      }
    }
    return this.forEach(function (value, index, array) {
      return ecc.ifelse(
        _tester.bind(null, value, index, array),
        reverse ? null : function () { newArray.push(value); },
        reverse ? function () { newArray.push(value); } : null
      );
    }).then(function () { return newArray; });
  };

  ////////////////////
  // Simple helpers //
  ////////////////////

  ExtendedCancellableChain.prototype.finally = function (fn) {
    return this.then(fn, fn).value(this);
  };

  ExtendedCancellableChain.prototype.value = function (value) {
    return this.then(function () {
      return value;
    });
  };

  ExtendedCancellableChain.prototype.call = function (thisArg, fn) {
    var args = [].slice.call(arguments, 2);
    return this.then(function (input) {
      return fn.apply(thisArg, args.concat([input]));
    });
  };

  ExtendedCancellableChain.prototype.apply = function (thisArg, fn, args) {
    return this.then(function (input) {
      return fn.apply(thisArg, [].concat(args, [input]));
    });
  };

  ///////////////
  // Modifiers //
  ///////////////

  ExtendedCancellableChain.prototype.wrapLines = function (wrap) {
    if (!(wrap > 0)) {
      return this.toText();
    }
    return this.toText().then(function (text) {
      var lines = [];
      text.split("\n").forEach(function (line) {
        while (line) {
          lines.push(line.slice(0, wrap));
          line = line.slice(wrap);
        }
      });
      return lines.join("\n");
    });
  };

  //////////////
  // Encoders //
  //////////////

  ExtendedCancellableChain.prototype.json = function (replacer, space) {
    return this.then(function (object) {
      return JSON.stringify(object, replacer, space);
    });
  };
  ExtendedCancellableChain.prototype.unjson = function () {
    return this.then(JSON.parse);
  };

  ExtendedCancellableChain.prototype.base64 = function () {
    return this.toArrayBuffer().then(arrayBufferToBase64);
  };
  ExtendedCancellableChain.prototype.unbase64 = function () {
    return this.toText().then(base64ToArrayBuffer);
  };
  ExtendedCancellableChain.prototype.hex = function () {
    return this.toArrayBuffer().then(arrayBufferToHexadecimal);
  };
  ExtendedCancellableChain.prototype.unhex = function () {
    return this.toText().then(hexadecimalToArrayBuffer);
  };

  /////////////
  // Hashers //
  /////////////

  // TODO md5

  /////////////
  // Ciphers //
  /////////////

  // XXX

  ////////////////
  // Converters //
  ////////////////

  ExtendedCancellableChain.prototype.toBlob = function (options) {
    // TODO if input === undefined, return undefined too ?
    return this.then(function (input) {
      if (input === undefined || input === null) {
        return new Blob([""], options || {});
      }
      if (input instanceof ArrayBuffer || input.buffer instanceof ArrayBuffer) {
        return new Blob([input], options || {});
      }
      if (input instanceof Blob) {
        return input;
      }
      return new Blob([input], options || {});
    });
  };

  ExtendedCancellableChain.prototype.toText = function () {
    // TODO if input === undefined, return undefined too ?
    return this.then(function (input) {
      if (input === undefined || input === null) {
        return "";
      }
      if (typeof input === "string") {
        return input;
      }
      if (input instanceof Blob) {
        return readBlobAsText(input);
      }
      if (input instanceof ArrayBuffer || input.buffer instanceof ArrayBuffer) {
        return readBlobAsText(new Blob([input]));
      }
      return readBlobAsText(new Blob([input]));
    });
  };

  ExtendedCancellableChain.prototype.toArrayBuffer = function () {
    // TODO if input === undefined, return undefined too ?
    return this.then(function (input) {
      if (input === undefined || input === null) {
        return new ArrayBuffer(0);
      }
      if (input instanceof Blob) {
        return readBlobAsArrayBuffer(input);
      }
      if (input instanceof ArrayBuffer) {
        return input;
      }
      if (input.buffer instanceof ArrayBuffer) {
        return input.buffer;
      }
      return readBlobAsArrayBuffer(new Blob([input]));
    });
  };

  ExtendedCancellableChain.prototype.toDataURI = function (contentType) {
    // TODO check contentType with regex?
    // TODO remove /;base64(;|$)/ from contentType?
    return this.base64().then(function (input) {
      return "data:" + (contentType || "") + ";base64," + input;
    });
  };


  ///////////////////////
  // Time manipulators //
  ///////////////////////

  ExtendedCancellableChain.prototype.sleep = function (ms) {
    return this.then(function (input) {
      var d = new CancellableDeferred(), i = setTimeout(d.resolve, ms, input);
      d.oncancel = function () {
        clearTimeout(i);
        d.fail(new Error("Cancelled"));
      };
      return d.promise;
    });
  };

  ExtendedCancellableChain.prototype.never = function () {
    return this.then(function () {
      var d = new CancellableDeferred();
      d.oncancel = function () { d.fail(new Error("Cancelled")); };
      return d.promise;
    });
  };


  //////////////////////
  // URI manipulators //
  //////////////////////

  ExtendedCancellableChain.prototype.ajax = function (param) {
    /**
     *    ecc.ajax({url: location, responseType: "text"}).get("data");
     *    ecc.ajax({url: location}).get("Content-Length");
     *    ecc.value(input).ajax({url: there, method: "put"})
     *
     * Send request with XHR and return a promise. xhr.onload: The promise is
     * resolved when the status code is lower than 400 with a forged response
     * object as resolved value. xhr.onerror: reject with an Error (with status
     * code in status property) as rejected value.
     *
     * @param  {Object} param The parameters
     * @param  {String} param.url The url
     * @param  {String} [param.method="GET"] The request method
     * @param  {String} [param.responseType=""] The data type to retrieve
     * @param  {String} [param.overrideMimeType] The mime type to override
     * @param  {Object} [param.headers] The headers to send
     * @param  {Any} [param.data] The data to send
     * @param  {Boolean} [param.withCredentials] Tell the browser to use
     *   credentials
     * @param  {Object} [param.xhrFields] The other xhr fields to fill
     * @param  {Boolean} [param.getEvent] Tell the method to return the
     *   response event.
     * @param  {Function} [param.beforeSend] A function called just before the
     *   send request. The first parameter of this function is the XHR object.
     * @param  {String} [param.inputKey="data"|"url"] The key to set thank to
     *   the input.
     * @return {ExtendedCancellableChain<Object>} Response object is like { data: .., header1: ..,
     *   header2: .., ... }
     */
    return this.then(function (input) {
      if (param.inputKey === undefined) {
        if (param.data === undefined) {
          param.data = input; // can be disable if param.data = null
        } else if (param.url === undefined && typeof input === "string") {
          param.url = input;
        }
      } else {
        param[param.inputKey] = input;
      }
      var d = new CancellableDeferred(), xhr = new XMLHttpRequest(), k;
      d.oncancel = function () { xhr.abort(); };
      xhr.open((param.method || "GET").toUpperCase(), param.url || param.uri, true);
      xhr.responseType = param.responseType || "";
      if (param.overrideMimeType) {
        xhr.overrideMimeType(param.overrideMimeType);
      }
      if (param.withCredentials !== undefined) {
        xhr.withCredentials = param.withCredentials;
      }
      if (param.headers) {
        for (k in param.headers) {
          if (param.headers.hasOwnProperty(k)) {
            xhr.setRequestHeader(k, param.headers[k]);
          }
        }
      }
      xhr.addEventListener("load", function (e) {
        if (param.getEvent) { return d.resolve(e); }
        var r;
        if (e.target.status < 400) {
          r = xmlHttpRequestHeadersToKeyValue(e.target.getAllResponseHeaders());
          r.data = e.target.response;
          return d.resolve(r);
        }
        r = new Error("request: " + (e.target.statusText || "unknown error"));
        r.status = e.target.status;
        return d.reject(r);
      }, false);
      xhr.addEventListener("error", function (e) {
        if (param.getEvent) { return d.resolve(e); }
        return d.reject(new Error("request: error"));
      }, false);
      xhr.addEventListener("abort", function (e) {
        if (param.getEvent) { return d.resolve(e); }
        return d.reject(new Error("request: aborted"));
      }, false);
      if (param.xhrFields) {
        for (k in param.xhrFields) {
          if (param.xhrFields.hasOwnProperty(k)) {
            xhr[k] = param.xhrFields[k];
          }
        }
      }
      if (typeof param.beforeSend === 'function') {
        param.beforeSend(xhr);
      }
      xhr.send(param.data);
      return d.promise;
    });
  };

  function methodURI(method, suffix) {
    return function (uri) {
      var it = this;
      return it.then(function () {
        var _uri = (uri && uri.uri) || uri, tmp = (/^([a-z]+):/).exec(_uri);
        if (tmp) {
          tmp = method +
                tmp[1].slice(0, 1).toUpperCase() + tmp[1].slice(1).toLowerCase() +
                suffix;
          if (typeof it[tmp] === "function") {
            return it[tmp](uri);
          }
          throw new Error("No method " + tmp + " found");
        }
        throw new Error("Invalid URI");
      });
    };
  }

  ExtendedCancellableChain.prototype.getURI = methodURI("get", "URI");
  ExtendedCancellableChain.prototype.putURI = methodURI("put", "URI");
  ExtendedCancellableChain.prototype.deleteURI = methodURI("delete", "URI");
  ExtendedCancellableChain.prototype.resolveURILinks = methodURI("resolve", "URILinks");
  ExtendedCancellableChain.prototype.getURILinks = methodURI("get", "URILinks"); // this.getURILinks().then(linksToElement);

  function methodRestURI(method) {
    return function (uri) {
      var obj = {
        "method": method,
        "responseType": "blob",
        "withCredentials": true
      }, verbose;
      return this.then(function (input) {
        obj.uri = (uri && uri.uri) || uri;
        if (typeof obj.uri === "string") {
          obj.uri = obj.uri.replace(/^(?:web)?dav(s?):/, function (match, s) {
            /*jslint unparam: true */
            return "http" + s + ":";
          });
        }
        if ((uri && uri.verbose) || false) { verbose = true; }
        return input;
      }).ajax(obj).then(function (e) {
        if (verbose) {
          e.method = method;
          e.uri = obj.uri;
          return e;
        }
        return e.data;
      });
    };
  }

  function methodResolveURLURI(protoTitle) {
    return function (uri) {
      return this["get" + protoTitle + "URI"](uri).toText().then(htmlToLinks).then(function (links) {
        // TODO clone links?
        var i, l = links.length;
        for (i = 0; i < l; i += 1) {
          links[i].link = resolveURLURI(uri, links[i].link);
        }
        return links;
      });
    };
  }

  function methodGetURILinks(protoTitle) {
    return function (uri) {
      return this["get" + protoTitle + "URI"](uri).toText().then(htmlToLinks)["resolve" + protoTitle + "URILinks"](uri);
    };
  }

  ExtendedCancellableChain.prototype.getHttpURI = methodRestURI("GET");
  ExtendedCancellableChain.prototype.putHttpURI = methodRestURI("PUT");
  ExtendedCancellableChain.prototype.deleteHttpURI = methodRestURI("DELETE");
  ExtendedCancellableChain.prototype.resolveHttpURILinks = methodResolveURLURI("Http");
  ExtendedCancellableChain.prototype.getHttpURILinks = methodGetURILinks("Http");
  ExtendedCancellableChain.prototype.getHttpsURI = methodRestURI("GET");
  ExtendedCancellableChain.prototype.putHttpsURI = methodRestURI("PUT");
  ExtendedCancellableChain.prototype.deleteHttpsURI = methodRestURI("DELETE");
  ExtendedCancellableChain.prototype.resolveHttpsURILinks = methodResolveURLURI("Https");
  ExtendedCancellableChain.prototype.getHttpsURILinks = methodGetURILinks("Https");
  ExtendedCancellableChain.prototype.getWebdavURI = methodRestURI("GET");
  ExtendedCancellableChain.prototype.putWebdavURI = methodRestURI("PUT");
  ExtendedCancellableChain.prototype.deleteWebdavURI = methodRestURI("DELETE");
  ExtendedCancellableChain.prototype.resolveWebdavURILinks = methodResolveURLURI("Webdav");
  ExtendedCancellableChain.prototype.getWebdavURILinks = methodGetURILinks("Webdav");
  ExtendedCancellableChain.prototype.getWebdavsURI = methodRestURI("GET");
  ExtendedCancellableChain.prototype.putWebdavsURI = methodRestURI("PUT");
  ExtendedCancellableChain.prototype.deleteWebdavsURI = methodRestURI("DELETE");
  ExtendedCancellableChain.prototype.resolveWebdavsURILinks = methodResolveURLURI("Webdavs");
  ExtendedCancellableChain.prototype.getWebdavsURILinks = methodGetURILinks("Webdavs");
  ExtendedCancellableChain.prototype.getDavURI = methodRestURI("GET");
  ExtendedCancellableChain.prototype.putDavURI = methodRestURI("PUT");
  ExtendedCancellableChain.prototype.deleteDavURI = methodRestURI("DELETE");
  ExtendedCancellableChain.prototype.resolveDavURILinks = methodResolveURLURI("Dav");
  ExtendedCancellableChain.prototype.getDavURILinks = methodGetURILinks("Dav");
  ExtendedCancellableChain.prototype.getDavsURI = methodRestURI("GET");
  ExtendedCancellableChain.prototype.putDavsURI = methodRestURI("PUT");
  ExtendedCancellableChain.prototype.deleteDavsURI = methodRestURI("DELETE");
  ExtendedCancellableChain.prototype.resolveDavsURILinks = methodResolveURLURI("Davs");
  ExtendedCancellableChain.prototype.getDavsURILinks = methodGetURILinks("Davs");

  ExtendedCancellableChain.prototype.getFileURI = methodRestURI("GET");

  ExtendedCancellableChain.prototype.resolveFileURILinks = function (uri) {
    return this.then(function (links) {
      // TODO clone links?
      var i, l = links.length;
      for (i = 0; i < l; i += 1) {
        links[i].link = resolveFileURI(uri, links[i].link);
      }
      return links;
    });
  };

  ExtendedCancellableChain.prototype.getFileURILinks = function (uri) {
    return this.getFileURI(uri).toText().then(htmlToLinks).resolveFileURILinks(uri);
  };

  ExtendedCancellableChain.prototype.getDataURI = function (uri) {
    return this.then(function () {
      var _uri, verbose;
      _uri = (uri && uri.uri) || uri;
      if ((uri && uri.verbose) || false) { verbose = true; }
      if (verbose) {
        verbose = parseDataURIAsBlob(_uri);
        return {
          "method": "GET",
          "uri": _uri,
          "data": verbose,
          "Content-Length": verbose.size,
          "Content-Type": verbose.type
        };
      }
      return parseDataURIAsBlob(_uri);
    });
  };

  ExtendedCancellableChain.prototype.getLocalstorageURI = function (uri) {
    return this.then(function () {
      var v = localStorage.getItem(uri.replace(/^localstorage:/, ""));
      if (v === null) {
        v = new Error("`" + uri + "` Not Found");
        v.status = 404;
        throw v;
      }
      return new Blob([v], {"type": "text/plain"});
    });
  };
  ExtendedCancellableChain.prototype.putLocalstorageURI = function (uri) {
    return this.toText().then(function (input) {
      localStorage.setItem(uri.replace(/^localstorage:/, ""), input);
    });
  };
  ExtendedCancellableChain.prototype.deleteLocalstorageURI = function (uri) {
    return this.then(function () {
      localStorage.removeItem(uri.replace(/^localstorage:/, ""));
    });
  };

  ExtendedCancellableChain.prototype.resolveLocalstorageURILinks = function (uri) {
    return this.then(function (links) {
      // TODO clone links?
      var i, l = links.length;
      for (i = 0; i < l; i += 1) {
        links[i].link = resolveLocalstorageURI(uri, links[i].link);
      }
      return links;
    });
  };

  ExtendedCancellableChain.prototype.getLocalstorageURILinks = function (uri) {
    return this.getLocalstorageURI(uri).toText().then(htmlToLinks).resolveLocalstorageURILinks(uri);
  };

  /////////////////////////
  // Pop-ups and loggers //
  /////////////////////////

  ExtendedCancellableChain.prototype.log = function (prefix) {
    /*global console */
    return this.then(function (a) {
      if (prefix !== undefined) {
        console.log(prefix, a);
      } else {
        console.log(a);
      }
      return a;
    }, function (e) {
      if (prefix !== undefined) {
        console.error(prefix, e);
      } else {
        console.error(e);
      }
      throw e;
    });
  };

  ExtendedCancellableChain.prototype.downloadAs = function () {
    /**
     *     ecc.value(input).downloadAs("myFile", "text/plain");
     *     ecc.value(input).downloadAs({"filename": "myFile", "mimetype": "text/plain"});
     *     ecc.value(input).downloadAs({"filename": "myFile"}, "text/plain");
     *
     * Allows the user to download `input` as a file which name is defined by
     * `filename`. The `mimetype` will help the browser to choose the associated
     * application to open with.
     *
     * @param  {String} filename The file name.
     * @param  {String} mimetype The data type.
     * @return {ExtendedCancellableChain} The input in an extended cancellable chain.
     */
    var args = [].reduce.call(arguments, function (prev, value) {
      var t = typeof value;
      if (prev[t]) { prev[t].push(value); }
      return prev;
    }, {"string": [], "object": []});
    if (!args.object[0]) { args.object[0] = {}; }
    return this.then(function (input) {
      downloadAs(
        args.string.shift() || args.object[0].filename,
        input,
        args.string.shift() || args.object[0].mimetype
      );
      return input;
    });
  };

  ExtendedCancellableChain.prototype.alert = function (message) {
    return this.then(function (input) {
      var layout, beam, windoww, p, ok, defer = new CancellableDeferred();
      function removeIt() {
        beam.remove();
        layout.remove();
      }
      function onOk() {
        removeIt();
        defer.resolve();
      }
      defer.oncancel = function () {
        removeIt();
        defer.reject(new Error("Cancelled"));
      };
      beam = document.createElement("div");
      beam.style.position = "fixed";
      beam.style.width = "100%";
      beam.style.maxHeight = "100%";
      beam.style.left = "0em";
      beam.style.top = "0em";
      beam.style.textAlign = "center";
      beam.style.overflow = "auto";
      document.body.insertBefore(beam, document.body.firstChild);

      windoww = document.createElement("div");
      windoww.style.backgroundColor = "white";
      windoww.style.color = "black";
      windoww.style.padding = "1em";
      windoww.style.margin = "auto";
      windoww.style.textAlign = "left";
      windoww.style.display = "inline-block";
      beam.appendChild(windoww);

      if (message === undefined) {
        message = input;
      }
      if (message !== undefined) {
        p = document.createElement("p");
        p.textContent = message;
        p.innerHTML = p.innerHTML.replace(/\n/gm, "<br/>");
        windoww.appendChild(p);
      }

      ok = document.createElement("button");
      ok.textContent = "OK";
      ok.addEventListener("click", onOk);
      ok.addEventListener("keydown", function (e) {
        if (e.key === "Esc" || e.key === "Escape" || e.keyIdentifier === "U+001B") {
          return onOk();
        }
      });
      windoww.appendChild(ok);
      setTimeout(ok.focus.bind(ok), 0);

      layout = document.createElement("div");
      layout.style.position = "fixed";
      layout.style.width = "100%";
      layout.style.height = "100%";
      layout.style.left = "0em";
      layout.style.top = "0em";
      layout.style.backgroundColor = "black";
      layout.style.opacity = "0.5";
      layout.style.margin = "0em";
      layout.style.padding = "0em";
      document.body.insertBefore(layout, document.body.firstChild);

      return defer.promise;
    });
  };

  ExtendedCancellableChain.prototype.confirm = function (message) {
    return this.then(function (input) {
      var layout, beam, windoww, p, cancel, ok, defer = new CancellableDeferred();
      function removeIt() {
        beam.remove();
        layout.remove();
      }
      function onCancel() {
        removeIt();
        defer.resolve(false);
      }
      function onOk() {
        removeIt();
        defer.resolve(true);
      }
      defer.oncancel = function () {
        removeIt();
        defer.reject(new Error("Cancelled"));
      };
      beam = document.createElement("div");
      beam.style.position = "fixed";
      beam.style.width = "100%";
      beam.style.maxHeight = "100%";
      beam.style.left = "0em";
      beam.style.top = "0em";
      beam.style.textAlign = "center";
      beam.style.overflow = "auto";
      document.body.insertBefore(beam, document.body.firstChild);

      windoww = document.createElement("div");
      windoww.style.backgroundColor = "white";
      windoww.style.color = "black";
      windoww.style.padding = "1em";
      windoww.style.margin = "auto";
      windoww.style.textAlign = "left";
      windoww.style.display = "inline-block";
      beam.appendChild(windoww);

      if (message === undefined) {
        message = input;
      }
      if (message !== undefined) {
        p = document.createElement("p");
        p.textContent = message;
        p.innerHTML = p.innerHTML.replace(/\n/gm, "<br/>");
        windoww.appendChild(p);
      }

      cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", onCancel);
      windoww.appendChild(cancel);
      ok = document.createElement("button");
      ok.textContent = "OK";
      ok.addEventListener("click", onOk);
      windoww.appendChild(ok);
      setTimeout(ok.focus.bind(ok), 0);

      layout = document.createElement("div");
      layout.style.position = "fixed";
      layout.style.width = "100%";
      layout.style.height = "100%";
      layout.style.left = "0em";
      layout.style.top = "0em";
      layout.style.backgroundColor = "black";
      layout.style.opacity = "0.5";
      layout.style.margin = "0em";
      layout.style.padding = "0em";
      document.body.insertBefore(layout, document.body.firstChild);

      return defer.promise;
    });
  };

  ExtendedCancellableChain.prototype.prompt = function (message) {
    return this.then(function (value) {
      var layout, beam, windoww, p, input, cancel, ok, defer = new CancellableDeferred(), tmp;
      function removeIt() {
        beam.remove();
        layout.remove();
      }
      function onCancel() {
        removeIt();
        defer.resolve(null);
      }
      function onOk() {
        removeIt();
        defer.resolve(input.value);
      }
      defer.oncancel = function () {
        removeIt();
        defer.reject(new Error("Cancelled"));
      };
      beam = document.createElement("div");
      beam.style.position = "fixed";
      beam.style.width = "100%";
      beam.style.maxHeight = "100%";
      beam.style.left = "0em";
      beam.style.top = "0em";
      beam.style.textAlign = "center";
      beam.style.overflow = "auto";
      document.body.insertBefore(beam, document.body.firstChild);

      windoww = document.createElement("div");
      windoww.style.backgroundColor = "white";
      windoww.style.color = "black";
      windoww.style.padding = "1em";
      windoww.style.margin = "auto";
      windoww.style.textAlign = "left";
      windoww.style.display = "inline-block";
      beam.appendChild(windoww);

      if (message !== undefined) {
        p = document.createElement("p");
        p.textContent = message;
        p.innerHTML = p.innerHTML.replace(/\n/gm, "<br/>");
        windoww.appendChild(p);
      }

      input = document.createElement("input");
      input.type = "text";
      if (value !== undefined) {
        input.value = value;
      }
      input.addEventListener("keydown", function (e) {
        if (e.key === "Esc" || e.key === "Escape" || e.keyIdentifier === "U+001B") {
          return onCancel();
        }
        if (e.key === "Enter" || e.keyIdentifier === "Enter") {
          return onOk();
        }
      });
      setTimeout(input.focus.bind(input), 0);
      tmp = document.createElement("div");
      tmp.appendChild(input);
      windoww.appendChild(tmp);

      cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", onCancel);
      windoww.appendChild(cancel);
      ok = document.createElement("button");
      ok.textContent = "OK";
      ok.addEventListener("click", onOk);
      windoww.appendChild(ok);

      layout = document.createElement("div");
      layout.style.position = "fixed";
      layout.style.width = "100%";
      layout.style.height = "100%";
      layout.style.left = "0em";
      layout.style.top = "0em";
      layout.style.backgroundColor = "black";
      layout.style.opacity = "0.5";
      layout.style.margin = "0em";
      layout.style.padding = "0em";
      document.body.insertBefore(layout, document.body.firstChild);

      return defer.promise;
    });
  };

  ExtendedCancellableChain.prototype.promptTextarea = function (message) {
    return this.then(function (value) {
      var layout, beam, windoww, p, textarea, cancel, ok, defer = new CancellableDeferred(), tmp;
      function removeIt() {
        beam.remove();
        layout.remove();
      }
      function onCancel() {
        removeIt();
        defer.resolve(null);
      }
      function onOk() {
        removeIt();
        defer.resolve(textarea.value);
      }
      defer.oncancel = function () {
        removeIt();
        defer.reject(new Error("Cancelled"));
      };
      beam = document.createElement("div");
      beam.style.position = "fixed";
      beam.style.width = "100%";
      beam.style.maxHeight = "100%";
      beam.style.left = "0em";
      beam.style.top = "0em";
      beam.style.textAlign = "center";
      beam.style.overflow = "auto";
      document.body.insertBefore(beam, document.body.firstChild);

      windoww = document.createElement("div");
      windoww.style.backgroundColor = "white";
      windoww.style.color = "black";
      windoww.style.padding = "1em";
      windoww.style.margin = "auto";
      windoww.style.textAlign = "left";
      windoww.style.display = "inline-block";
      beam.appendChild(windoww);

      if (message !== undefined) {
        p = document.createElement("p");
        p.textContent = message;
        p.innerHTML = p.innerHTML.replace(/\n/gm, "<br/>");
        windoww.appendChild(p);
      }

      textarea = document.createElement("textarea");
      if (value !== undefined) {
        textarea.value = value;
      }
      textarea.addEventListener("keydown", function (e) {
        if (e.key === "Esc" || e.key === "Escape" || e.keyIdentifier === "U+001B") {
          return onCancel();
        }
      });
      setTimeout(textarea.focus.bind(textarea), 0);
      tmp = document.createElement("div");
      tmp.appendChild(textarea);
      windoww.appendChild(tmp);

      cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", onCancel);
      windoww.appendChild(cancel);
      ok = document.createElement("button");
      ok.textContent = "OK";
      ok.addEventListener("click", onOk);
      windoww.appendChild(ok);

      layout = document.createElement("div");
      layout.style.position = "fixed";
      layout.style.width = "100%";
      layout.style.height = "100%";
      layout.style.left = "0em";
      layout.style.top = "0em";
      layout.style.backgroundColor = "black";
      layout.style.opacity = "0.5";
      layout.style.margin = "0em";
      layout.style.padding = "0em";
      document.body.insertBefore(layout, document.body.firstChild);

      return defer.promise;
    });
  };

  ExtendedCancellableChain.prototype.promptFile = function (message) {
    return this.then(function () {
      var layout, beam, windoww, p, input, cancel, ok, defer = new CancellableDeferred(), tmp;
      function removeIt() {
        beam.remove();
        layout.remove();
      }
      function onCancel() {
        removeIt();
        defer.resolve(null);
      }
      function onOk() {
        removeIt();
        defer.resolve(input.files[0]);
      }
      defer.oncancel = function () {
        removeIt();
        defer.reject(new Error("Cancelled"));
      };
      beam = document.createElement("div");
      beam.style.position = "fixed";
      beam.style.width = "100%";
      beam.style.maxHeight = "100%";
      beam.style.left = "0em";
      beam.style.top = "0em";
      beam.style.textAlign = "center";
      beam.style.overflow = "auto";
      document.body.insertBefore(beam, document.body.firstChild);

      windoww = document.createElement("div");
      windoww.style.backgroundColor = "white";
      windoww.style.color = "black";
      windoww.style.padding = "1em";
      windoww.style.margin = "auto";
      windoww.style.textAlign = "left";
      windoww.style.display = "inline-block";
      beam.appendChild(windoww);

      if (message !== undefined) {
        p = document.createElement("p");
        p.textContent = message;
        p.innerHTML = p.innerHTML.replace(/\n/gm, "<br/>");
        windoww.appendChild(p);
      }

      input = document.createElement("input");
      input.type = "file";
      input.addEventListener("keydown", function (e) {
        if (e.key === "Esc" || e.key === "Escape" || e.keyIdentifier === "U+001B") {
          return onCancel();
        }
      });
      setTimeout(input.focus.bind(input), 0);
      tmp = document.createElement("div");
      tmp.appendChild(input);
      windoww.appendChild(tmp);

      cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", onCancel);
      windoww.appendChild(cancel);
      ok = document.createElement("button");
      ok.textContent = "OK";
      ok.addEventListener("click", onOk);
      windoww.appendChild(ok);

      layout = document.createElement("div");
      layout.style.position = "fixed";
      layout.style.width = "100%";
      layout.style.height = "100%";
      layout.style.left = "0em";
      layout.style.top = "0em";
      layout.style.backgroundColor = "black";
      layout.style.opacity = "0.5";
      layout.style.margin = "0em";
      layout.style.padding = "0em";
      document.body.insertBefore(layout, document.body.firstChild);

      return defer.promise;
    });
  };

  ExtendedCancellableChain.prototype.promptFiles = function (message) {
    return this.then(function () {
      var layout, beam, windoww, p, input, cancel, ok, defer = new CancellableDeferred(), tmp;
      function removeIt() {
        beam.remove();
        layout.remove();
      }
      function onCancel() {
        removeIt();
        defer.resolve(null);
      }
      function onOk() {
        removeIt();
        defer.resolve(input.files);
      }
      defer.oncancel = function () {
        removeIt();
        defer.reject(new Error("Cancelled"));
      };
      beam = document.createElement("div");
      beam.style.position = "fixed";
      beam.style.width = "100%";
      beam.style.maxHeight = "100%";
      beam.style.left = "0em";
      beam.style.top = "0em";
      beam.style.textAlign = "center";
      beam.style.overflow = "auto";
      document.body.insertBefore(beam, document.body.firstChild);

      windoww = document.createElement("div");
      windoww.style.backgroundColor = "white";
      windoww.style.color = "black";
      windoww.style.padding = "1em";
      windoww.style.margin = "auto";
      windoww.style.textAlign = "left";
      windoww.style.display = "inline-block";
      beam.appendChild(windoww);

      if (message !== undefined) {
        p = document.createElement("p");
        p.textContent = message;
        p.innerHTML = p.innerHTML.replace(/\n/gm, "<br/>");
        windoww.appendChild(p);
      }

      input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.addEventListener("keydown", function (e) {
        if (e.key === "Esc" || e.key === "Escape" || e.keyIdentifier === "U+001B") {
          return onCancel();
        }
      });
      setTimeout(input.focus.bind(input), 0);
      tmp = document.createElement("div");
      tmp.appendChild(input);
      windoww.appendChild(tmp);

      cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", onCancel);
      windoww.appendChild(cancel);
      ok = document.createElement("button");
      ok.textContent = "OK";
      ok.addEventListener("click", onOk);
      windoww.appendChild(ok);

      layout = document.createElement("div");
      layout.style.position = "fixed";
      layout.style.width = "100%";
      layout.style.height = "100%";
      layout.style.left = "0em";
      layout.style.top = "0em";
      layout.style.backgroundColor = "black";
      layout.style.opacity = "0.5";
      layout.style.margin = "0em";
      layout.style.padding = "0em";
      document.body.insertBefore(layout, document.body.firstChild);

      return defer.promise;
    });
  };


  //////////////////////////////////////////////////

  function BasicStream(next, previous) {
    this._next = next;
    this._previous = previous;
  }
  BasicStream.prototype.next = function () {
    if (this._closed) { return Promise.resolve({done: true}); }
    return this._next();
  };
  BasicStream.prototype.close = function () {
    this._closed = true;
    if (this._previous && typeof this._previous.close === "function") {
      this._previous.close();
    }
  };
  toolbox.BasicStream = BasicStream;

  //////////////////////////////////////////////////

  function StreamableChain(streamable, previous, onNext) {
    this._streamable = streamable || StreamableChain.ended;
    this._previous = previous;
    this._onNext = onNext;
  }
  StreamableChain.ended = {
    toStream: function () {
      return new BasicStream(function () {
        return Promise.resolve({"done": true});
      });
    }
  };
  StreamableChain.blackHole = {
    push: function () {
      return;
    }
  };
  StreamableChain.prototype.stream = function (onNext) {
    return new StreamableChain(this, this, onNext);
  };
  StreamableChain.prototype.toStream = function () {
    if (typeof this._onNext !== "function") {
      return this._streamable.toStream();
    }
    var stream = this._streamable.toStream();
    return new BasicStream(this._onNext.bind(null, stream), this._streamable.toStream());
  };
  toolbox.StreamableChain = StreamableChain;

  //////////////////////////////////////////////////

  function ExtendedStreamableChain() {
    StreamableChain.apply(this, arguments);
  }
  ExtendedStreamableChain.prototype = Object.create(StreamableChain.prototype);
  ExtendedStreamableChain.prototype.stream = function (onNext) {
    return new ExtendedStreamableChain(this, this, onNext);
  };
  ExtendedStreamableChain.pipe = function (stream, pushable) {
    var ecc = new ExtendedCancellableChain();
    return ecc.while(function () {
      return ecc.value(stream.next()).then(function (next) {
        if (next.done) { return false; }
        return ecc.value(next.value).call(pushable, pushable.push).value(true);
      });
    }).value(pushable);
  };
  ExtendedStreamableChain.makeBasicStreamer = function (onInit, onNext, onEnd) {
    var vars = {}, ecc = new ExtendedCancellableChain(), cur = ecc, first = true, last;
    if (typeof onInit !== "function") { onInit = function () { return; }; }
    if (typeof onNext !== "function") { onNext = function () { return; }; }
    if (typeof onEnd !== "function") { onEnd = function () { return; }; }
    return function (stream) {
      if (first) {
        first = false;
        cur = ecc.call(vars, onInit);
      }
      cur = cur.then(function rec() {
        if (last) { return {"done": true}; }
        return ecc.call(stream, stream.next).then(function (next) {
          if (next.done) {
            last = true;
            return ecc.call(vars, onEnd).then(function (value) {
              if (value === undefined) {
                return {"done": true};
              }
              return {value: value};
            });
          }
          return ecc.call(vars, onNext, next.value).then(function (value) {
            if (value === undefined) {
              return rec();
            }
            return {value: value};
          });
        });
      });
      return cur;
    };
  };
  toolbox.ExtendedStreamableChain = ExtendedStreamableChain;

  ////////////////
  // Generators //
  ////////////////

  ExtendedStreamableChain.prototype.infinite = function (value) {
    return this.stream(function () {
      return Promise.resolve({value: value});
    });
  };

  ExtendedStreamableChain.prototype.random = function () {
    return this.stream(function () {
      return Promise.resolve({value: Math.random()});
    });
  };

  ExtendedStreamableChain.prototype.counter = function () {
    var count = 0;
    return this.stream(function () {
      count += 1;
      return Promise.resolve({value: count});
    });
  };

  ExtendedStreamableChain.prototype.array = function (array) {
    var i = 0;
    return this.stream(function () {
      /*jslint plusplus: true */
      if (i < array.length) {
        return Promise.resolve({value: array[i++]});
      }
      return Promise.resolve({"done": true});
    });
  };

  ExtendedStreamableChain.prototype.range = function (start, end, step) {
    // range(start, end) === range(start, end, 1)
    // range(end)        === range(0, end, 1)
    if (arguments.length === 2) {
      step = 1;
    } else if (arguments.length === 1) {
      end = start;
      start = 0;
      step = 1;
    }
    if (step < 0) {
      return this.stream(function () {
        if (start <= end) { return Promise.resolve({done: true}); }
        start += step;
        return Promise.resolve({value: start - step});
      });
    }
    return this.stream(function () {
      if (start >= end) { return Promise.resolve({done: true}); }
      start += step;
      return Promise.resolve({value: start - step});
    });
  };

  ///////////////
  // Injecters //
  ///////////////

  ExtendedStreamableChain.prototype.value = function (chunk) {
    // send `chunk` then pipe
    var done;
    return this.stream(function (stream) {
      if (done) {
        return stream.next();
      }
      done = true;
      return {value: chunk};
    });
  };

  ExtendedStreamableChain.prototype.echo = function () {
    // pipe then send all parameters.
    var done, i = 0, args = [].slice.call(arguments), ecc = new ExtendedCancellableChain(), cur = ecc;
    return this.stream(function (stream) {
      cur = cur.then(function () {
        /*jslint plusplus: true */
        if (done) {
          if (i < args.length) {
            return {value: args[i++]};
          }
          return {"done": true};
        }
        return ecc.call(stream, stream.next).then(function (next) {
          if (next.done) {
            done = true;
            if (i < args.length) {
              return {value: args[i++]};
            }
            return {"done": true};
          }
          return {value: next.value};
        });
      });
      return cur;
    });
  };

  /////////////
  // Loggers //
  /////////////

  ExtendedStreamableChain.prototype.log = function () {
    var ecc = new ExtendedCancellableChain();
    return this.stream(function (stream) {
      return ecc.value(stream.next()).then(function (next) {
        if (next.done) { return next; }
        console.log(next.value);
        return next;
      });
    });
  };

  ///////////////
  // Modifiers //
  ///////////////

  ExtendedStreamableChain.prototype.toLines = function () {
    var ecc = new ExtendedCancellableChain(), lines = [], remaining = [], chr = "\n".charCodeAt(0);
    return this.toArrayBuffers().stream(function (stream) {
      if (lines === null) {
        return {"done": true};
      }
      if (lines.length) {
        return {value: lines.shift()};
      }
      return ecc.call(stream, stream.next).then(function rec(next) {
        if (next.done) {
          lines = null;
          if (remaining.length) {
            return {value: new Blob(remaining)};
          }
          return {"done": true};
        }
        var j = 0, i, value = new Uint8Array(next.value), l = value.length;
        for (i = 0; i < l; i += 1) {
          if (value[i] === chr) {
            lines.push(value.buffer.slice(j, i + 1));
            j = i + 1;
          }
        }
        if (lines.length) {
          remaining.push(lines.shift());
          l = new Blob(remaining);
          if (j !== i) {
            remaining = [value.buffer.slice(j)];
          } else {
            remaining = [];
          }
          return {value: l};
        }
        if (j !== i) {
          remaining.push(value.buffer.slice(j));
        }
        return ecc.value(stream.next()).then(rec);
      });
    }).toTexts();
  };

  // XXX ExtendedStreamableChain.prototype.wrapLines = function () {

  ////////////////
  // Converters //
  ////////////////

  ExtendedStreamableChain.prototype.toBlobs = function (options) {
    var ecc = new ExtendedCancellableChain();
    return this.stream(function (stream) {
      return ecc.call(stream, stream.next).then(function (next) {
        if (next.done) { return {"done": true}; }
        return ecc.value(next.value).toBlob(options).then(function (value) {
          return {value: value};
        });
      });
    });
  };
  ExtendedStreamableChain.prototype.toTexts = function () {
    var ecc = new ExtendedCancellableChain();
    return this.stream(function (stream) {
      return ecc.call(stream, stream.next).then(function (next) {
        if (next.done) { return {"done": true}; }
        return ecc.value(next.value).toText().then(function (value) {
          return {value: value};
        });
      });
    });
  };
  ExtendedStreamableChain.prototype.toArrayBuffers = function () {
    var ecc = new ExtendedCancellableChain();
    return this.stream(function (stream) {
      return ecc.call(stream, stream.next).then(function (next) {
        if (next.done) { return {"done": true}; }
        return ecc.value(next.value).toArrayBuffer().then(function (value) {
          return {value: value};
        });
      });
    });
  };
  ExtendedStreamableChain.prototype.toDataURIs = function (contentType) {
    var ecc = new ExtendedCancellableChain();
    return this.stream(function (stream) {
      return ecc.call(stream, stream.next).then(function (next) {
        if (next.done) { return {"done": true}; }
        return ecc.value(next.value).toDataURI(contentType).then(function (value) {
          return {value: value};
        });
      });
    });
  };
  ExtendedStreamableChain.prototype.toDataURI = function (contentType) {
    // TODO check contentType with regex?
    // TODO remove /;base64(;|$)/ from contentType?
    var done;
    return this.base64().stream(function (stream) {
      if (done) {
        return stream.next();
      }
      done = true;
      return {value: "data:" + (contentType || "") + ";base64,"};
    });
  };

  /////////////
  // Filters //
  /////////////

  ExtendedStreamableChain.prototype.filter = function (tester, option) {
    // tester can be an object with a `test` method, a function or a simple value
    var ecc = new ExtendedCancellableChain();
    return this.stream(ExtendedStreamableChain.makeBasicStreamer(function () {
      this.tester = function (value) { return value === tester; };
      this.index = 0;
      this.reverse = (option && option.reverse) || option === "reverse";
      if (tester) {
        if (typeof tester.test === "function") {
          this.tester = function (value) { return tester.test(value); };
        } else if (typeof tester === "function") {
          this.tester = tester;
        }
      }
    }, function (value) {
      /*jslint plusplus: true */
      return ecc.value(this.tester(value, this.index++)).ifelse(function (r) {
        return r;
      }, this.reverse ? null : function () {
        return value;
      }, this.reverse ? function () {
        return value;
      } : null);
    }));
  };

  ExtendedStreamableChain.prototype.select = function (start, end, step, offset) {
    // select(start, end, step) === select(start, end, 1, 0)
    // select(start, end)       === select(start, end, 1, 0)
    // select(start)            === select(start, Infinity, 1, 0)
    if (typeof start !== "number") { start = 0; }
    if (typeof end !== "number") { end = Infinity; }
    if (typeof step !== "number") { step = 1; }
    offset += start;
    if (typeof offset !== "number" || isNaN(offset)) { offset = 0; }
    var ecc = new ExtendedCancellableChain(), i = 0, done;
    return this.stream(function (stream) {
      if (done) {
        return Promise.resolve({"done": true});
      }
      return ecc.call(stream, stream.next).then(function rec(next) {
        if (next.done) {
          return {"done": true};
        }
        i += 1;
        if ((i - 1 + offset) % step) {
          return ecc.value(stream.next()).then(rec);
        }
        if (!(i <= start)) {
          if (i <= end) {
            if (i === end) { done = true; }
            return {value: next.value};
          }
          return {"done": true};
        }
        if (!(i <= start) && i <= end) {
          return {value: next.value};
        }
        return ecc.value(stream.next()).then(rec);
      });
    });
  };

  ExtendedStreamableChain.prototype.limit = function (start, length) {
    if (typeof length !== "number") { length = Infinity; }
    return this.select(start, start + length);
  };

  // XXX ExtendedStreamableChain.prototype.grep = function (xxx) {

  //////////////
  // Encoders //
  //////////////

  ExtendedStreamableChain.prototype.base64 = function () {
    return this.toArrayBuffers().stream(ExtendedStreamableChain.makeBasicStreamer(function () {
      this.remaining = "";
    }, function (chunk) {
      chunk = arrayBufferToBinaryString(chunk);
      var tmp;
      if (this.remaining) {
        chunk = this.remaining + chunk;
      }
      if (chunk.length % 3) {
        tmp = chunk.length - (chunk.length % 3);
        this.remaining = chunk.slice(tmp);
        chunk = chunk.slice(0, tmp);
      }
      if (chunk.length > 2) {
        return btoa(chunk);
      }
    }, function () {
      if (this.remaining) {
        return btoa(this.remaining);
      }
    }));
  };

  ExtendedStreamableChain.prototype.unbase64 = function () {
    return this.toTexts().stream(ExtendedStreamableChain.makeBasicStreamer(function () {
      this.remaining = "";
    }, function (chunk) {
      var tmp;
      if (this.remaining) {
        chunk = this.remaining + chunk;
      }
      if (chunk.length % 4) {
        tmp = chunk.length - (chunk.length % 4);
        this.remaining = chunk.slice(tmp);
        chunk = chunk.slice(0, tmp);
      }
      if (chunk.length > 3) {
        return binaryStringToArrayBuffer(atob(chunk));
      }
    }, function () {
      if (this.remaining) {
        return binaryStringToArrayBuffer(atob(this.remaining));
      }
    }));
  };

  ExtendedStreamableChain.prototype.hex = function () {
    return this.toArrayBuffers().stream(ExtendedStreamableChain.makeBasicStreamer(function () {
      return;
    }, function (chunk) {
      if (chunk.byteLength > 0) {
        return binaryStringToHexadecimal(arrayBufferToBinaryString(chunk));
      }
    }, function () {
      return;
    }));
  };

  ExtendedStreamableChain.prototype.unhex = function () {
    return this.toTexts().stream(ExtendedStreamableChain.makeBasicStreamer(function () {
      this.remaining = "";
    }, function (chunk) {
      if (this.remaining) {
        chunk = this.remaining + chunk;
      }
      if (chunk.length % 2) {
        this.remaining = chunk.slice(-1);
        chunk = chunk.slice(0, -1);
      }
      if (chunk.length > 1) {
        return binaryStringToArrayBuffer(hexadecimalToBinaryString(chunk));
      }
    }, function () {
      if (this.remaining) {
        return binaryStringToArrayBuffer(hexadecimalToBinaryString(this.remaining + "0"));
      }
    }));
  };

  /////////////
  // Hashers //
  /////////////

  // XXX md5, sha1, ...

  /////////////
  // Ciphers //
  /////////////

  // XXX

  ///////////////////////
  // Time manipulators //
  ///////////////////////

  ExtendedStreamableChain.prototype.delay = function (ms) {
    // slow down every pull
    var ecc = new ExtendedCancellableChain();
    return this.stream(function (stream) {
      return ecc.sleep(ms).call(stream, stream.next);
    });
  };

  ExtendedStreamableChain.prototype.sleep = function (ms) {
    // slow down every chunk
    var ecc = new ExtendedCancellableChain(), cur = ecc;
    return this.stream(function (stream) {
      cur = cur.then(function () {
        return ecc.sleep(ms).call(stream, stream.next);
      });
      return cur;
    });
  };

  /////////////
  // Pullers //
  /////////////

  ExtendedStreamableChain.prototype.pullAllTo = function (pushable) {
    return this.stream(function (stream) {
      return ExtendedStreamableChain.pipe(stream, pushable).value({done: true});
    });
  };

  ExtendedStreamableChain.prototype.blackHole = function () {
    return this.pullAllTo(StreamableChain.blackHole);
  };

  ExtendedStreamableChain.prototype.count = function () {
    var obj = {value: 0}, pushable = {push: function () {
      obj.value += 1;
    }};
    return this.stream(function (stream) {
      if (obj.value) { return Promise.resolve({done: true}); }
      return ExtendedStreamableChain.pipe(stream, pushable).value(obj);
    });
  };


  return toolbox;
}());
