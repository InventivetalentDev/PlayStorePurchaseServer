const fs = require("fs");

fs.readFile("licenseKey","utf8",(err,data)=>{
    if (err) {
        console.warn(err);
        return;
    }

    console.log(data);

    let bytes = Buffer.from(data, 'base64');
    console.log(bytes);
    console.log(bytes.length)

    fs.writeFile("licenseKey.bin",bytes,()=>{

    })
});
