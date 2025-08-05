const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--start-maximized',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding'
        ],
        defaultViewport: null
    });

    // 存储原始页面引用
    let originalPage = await browser.newPage();

    await originalPage.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    });

    await originalPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window._originalDebugger = window.debugger;
        window.debugger = function(){};
    });

    try {
        // 导航到登录页面
        await originalPage.goto('https://ualex-gf.faf.com.cn/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('请手动完成登录操作...');

        // 等待跳转到main.html
        await originalPage.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 300000
        });
        console.log('已跳转到主页面:', originalPage.url());

        // 创建新页面打开事件监听器
        let targetPage = null;
        const newPagePromise = new Promise((resolve) => {
            browser.on('targetcreated', async (target) => {
                if (target.url().includes('https://apmcv.17ebank.com:9117/dsp/')) {
                    console.log('检测到目标页面创建:', target.url());
                    targetPage = await target.page();
                    resolve(targetPage);
                }
            });
        });

        console.log('请手动点击按钮打开目标页面...');

        // 等待新页面打开或当前页面跳转
        const openedPage = await Promise.race([
            newPagePromise,
            originalPage.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: 300000
            }).then(() => originalPage)
        ]);

        // 确定最终要操作的页面
        const finalPage = targetPage || openedPage;
        console.log('最终操作页面:', finalPage.url());

        // 确保页面加载完成
        await finalPage.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 300000
        });

        // 等待目标元素出现
        await finalPage.waitForSelector('.el-submenu__title', {
            visible: true,
            timeout: 300000
        });

        // 保存目标页面的认证数据
        const cookies = await finalPage.cookies();
        fs.writeFileSync('./cookies.json', JSON.stringify(cookies));

        const localStorageData = await finalPage.evaluate(() =>
            JSON.stringify(localStorage)
        );
        fs.writeFileSync('./local_storage.json', localStorageData);

        console.log("目标页面认证数据保存成功!");

    } catch (error) {
        console.error('操作失败:', error);
    } finally {
        // 调试时可注释关闭
        // await browser.close();
    }
})();