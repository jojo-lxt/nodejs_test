const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    // 1. 启动浏览器（调试时可关闭无头模式）
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: false,  // 设为 true 则隐藏浏览器界面
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        defaultViewport: null
    });

    // 2. 打开新页面
    const page = await browser.newPage();
    // await page.setViewport({ width: 1500, height: 800 });

    try {
        await page.goto('https://ualex-gf.faf.com.cn/', {
            waitUntil: 'networkidle2' // 等待页面完全加载
        });

        // await page.type('#username', 'L32300GCV', { delay: 100 });
        // await page.type('#zcdl', 'XMn@2024.0524', { delay: 100 });

        await page.waitForSelector('.el-submenu__title', {
            visible: true,
            timeout: 300000
        });

        const cookies = await browser.cookies();
        fs.writeFileSync('./cookies.json', JSON.stringify(cookies));

        const localStorageData = await page.evaluate(() => {
            const jsonData = JSON.stringify(localStorage);
            console.log(jsonData)
            return jsonData;
        });

        fs.writeFileSync('./local_storage.json', localStorageData);

        console.log("cookies 和 localStorage 数据已保存到文件中");

    } catch (error) {
        console.error('操作失败:', error.message);
    } finally {
        // 8. 关闭浏览器
        // await browser.close();
    }
})();