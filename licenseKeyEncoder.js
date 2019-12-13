const fs = require("fs");


// Takes a 'licenseKey' file containing the google play public key and
// XOR encrypts it using the content of 'encryptionKey'

// Outputs the following files:
//      licenseKey.bin          Provided public key as bytes
//      licenseKeyEncrypted     XOR Encrypted public key as base64
//      licenseKeyEncrypted.bin XOR Encrypted public key as bytes
// Also prints a JSON array of bytes to decrypt the key on the client again

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

        console.log("Key Array:");
        console.log(JSON.stringify(stringToArray(keyData)));

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
        let same = decrypted === data;
        console.log("can decrypt: " + same);


    })
});


function encryptionTest() {
    let input = "Keyboard Kitten";
    let key = "I am a key!";

    console.log("input: " + input);

    console.log(JSON.stringify(stringToArray(key)));

    let encrypted = encrypt(input, key);
    console.log("encrypted: " + encrypted);

    let decrypted = decrypt(encrypted, key);
    console.log("decrypted: " + decrypted);


    let same = input === decrypted;
    console.log("input == decrypted: " + same);
}

encryptionTest();

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

function stringToArray(input) {
    let output = [];

    for (let i = 0; i < input.length; i++) {
        let charCode = input.charCodeAt(i) ;
        output.push(charCode);
    }
    return output;
}

