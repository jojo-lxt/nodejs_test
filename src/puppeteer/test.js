const fs = require('fs');

(() => {
    try {
        const data = fs.readFileSync('./path.json', 'utf-8');
        console.log(JSON.parse(data));
        console.log(data)
    } catch (error) {
        console.error('Error reading file:', error);
    }
})()