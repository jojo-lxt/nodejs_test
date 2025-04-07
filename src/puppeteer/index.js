import puppeteer from "puppeteer";

(async () => {
    // 1. 启动浏览器（调试时可关闭无头模式）
    const browser = await puppeteer.launch({
        headless: false,  // 设为 true 则隐藏浏览器界面
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 2. 打开新页面
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 800 });

    try {
        await page.goto('https://ualex-gf.faf.com.cn/', {
            waitUntil: 'networkidle2' // 等待页面完全加载
        });

        await page.type('#username', 'L32300GCV', { delay: 100 });
        await page.type('#zcdl', 'XMn@2024.0524', { delay: 100 });

        await page.waitForSelector('.el-submenu__title', {
            visible: true,
            timeout: 60000
        });

        await page.click('.el-submenu__title');

        await page.click('.el-menu-item')

        const targetElements = await page.$$('::-p-xpath(//li[contains(@class, "el-menu-item")])');

        await targetElements[1].click();

        await page.waitForSelector('input[placeholder="请输入合同号"]');

        const contractInput = await page.$('input[placeholder="请输入合同号"]');

        await contractInput.type('GCXJHMSC00123', {delay: 100})

        await page.click('.el-button--primary')

        await page.screenshot({
            path: 'baidu_cat_search.png',
            fullPage: true // 截取完整滚动页
        });

        console.log('截图已保存为 baidu_cat_search.png');

    } catch (error) {
        console.error('操作失败:', error.message);
    } finally {
        // 8. 关闭浏览器
        // await browser.close();
    }
})();