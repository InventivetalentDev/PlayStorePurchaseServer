const fs = require("fs");

fs.readFile("licenseKey", "utf8", (err, data) => {
    if (err) {
        console.warn(err);
        return;
    }
    fs.readFile("encryptionKey", "utf8", (err, keyData) => {
        if (err) {
            console.warn(err);
            return;
        }

        let bytes = Buffer.from(data, 'base64');
        console.log(bytes.length + " bytes in raw google play key");

        fs.writeFile("licenseKey.bin", bytes, () => {
        });

        let encrypted = encrypt(data, keyData);
        fs.writeFile("licenseKeyEncrypted", encrypted, () => {
        });
        let encryptedBytes = Buffer.from(encrypted, "base64");
        fs.writeFile("licenseKeyEncrypted.bin", encryptedBytes, () => {
        });

        let decrypted = decrypt(encrypted, keyData);
        let decryptedBase64 = Buffer.from(decrypted).toString("base64");
        let same = decrypted === data;
        console.log("can decrypt: " + same);


    })
});


function encryptionTest() {
    let input = "This is a random string to test stuff";
    let key = "I am a key!";

    console.log("input: " + input);

    let encrypted = encrypt(input, key);
    console.log("encrypted: " + encrypted);

    let decrypted = decrypt(encrypted, key);
    console.log("decrypted: " + decrypted);


    let same = input === decrypted;
    console.log("input == decrypted: " + same);
}

// encryptionTest();

function crypt(input, key) {
    let output = [];

    for (let i = 0; i < input.length; i++) {
        let charCode = input.charCodeAt(i) ^ key[i % key.length].charCodeAt(0);
        output.push(charCode);
    }

    return output;
}

function encrypt(input, key) {
    let buf = Buffer.from(input).toString("ascii");
    let output = crypt(buf, key);
    return Buffer.from(output).toString("base64");
}

function decrypt(input, key) {
    let buf = Buffer.from(input, "base64").toString("ascii");
    let output = crypt(buf, key);
    return Buffer.from(output).toString("ascii");
}


