const puppeteer = require('puppeteer-core');
const fs = require('fs');
const {downloadAllImages, moveLatestReceipt} = require("./functions");
const XLSX = require("xlsx");

// 程序运行时等待函数
const waitSync = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // 读取路径
    const pathText = fs.readFileSync('./path.json', 'utf-8');
    const {excelPath, targetDir, downloadPath} = JSON.parse(pathText);

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
        const page = targetPage || openedPage;
        console.log('最终操作页面:', page.url());

        // 确保页面加载完成
        await page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 300000
        });

        async function handlePage(contractID, savePath) {
            // 展开贷后管理
            const submenuElement = await page.waitForSelector('.el-submenu__title', {
                visible: true,
                timeout: 60000
            });

            await submenuElement.click();

            await waitSync(1000)

            // 点击委托诉讼
            await page.waitForSelector('::-p-xpath(//span[text()="委托诉讼"])', {
                visible: true,
                timeout: 60000
            });

            await page.click('::-p-xpath(//span[text()="委托诉讼"])');

            // const targetElements = await page.$$('::-p-xpath(//li[contains(@class, "el-menu-item")])');
            //
            // await targetElements[1].click();

            await waitSync(3000)

            // 输入合同号并搜索
            await page.waitForSelector('input[placeholder="请输入合同号"]', {
                visible: true,
                timeout: 60000
            });

            const contractInput = await page.$('input[placeholder="请输入合同号"]');

            await contractInput.type(contractID, {delay: 100})

            await page.click('.el-button--primary')

            // 双击第一条信息
            const dblclickElement = await page.waitForSelector(`::-p-xpath(//div[@class="cell" and text()='${contractID}'])`, {
                visible: true
            });

            await dblclickElement.evaluate(el => {
                const event = new MouseEvent('dblclick', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                el.dispatchEvent(event);
            })

            // 点击查看合同相关信息
            const contractInformation = await page.waitForSelector('::-p-xpath(//span[text()="查看合同相关信息"])', {
                visible: true,
                timeout: 60000
            })

            await contractInformation.click()

            await waitSync(1000)

            // 点击档案资料
            const archivalData = await page.waitForSelector('::-p-xpath(//div[text()="档案资料"])', {
                visible: true,
                timeout: 60000
            })

            await archivalData.click()

            // 获取所有图片 URL
            await waitSync(5000)

            const imageUrls = await page.evaluate(() => {
                const images = Array.from(document.querySelectorAll('img'));
                return images.map(img => img.src).filter(img => img.startsWith('https://af.faf.com.cn/'));
            });

            console.log(`合同号: ${contractID}, 图片数量: ${imageUrls.length}`);

            // 下载所有图片
            await downloadAllImages(imageUrls, savePath);

            // 返回委托诉讼反馈情况
            await page.click('::-p-xpath(//span[text()="               委托诉讼反馈情况               "])');

            // 点击文档下载
            const documentDownload = await page.waitForSelector('::-p-xpath(//span[text()="文档下载"])', {
                visible: true,
                timeout: 60000
            });

            await documentDownload.click()

            // 下载电子回单
            const buttonXPath = '::-p-xpath(//tr[contains(@class,"el-table__row")]//div[text()="电子回单"]/ancestor::tr//button[contains(@class,"el-button--text")])';
            const downloadButton = await page.waitForSelector(buttonXPath, {
                visible: true,
                timeout: 60000
            });

            await downloadButton.click()

            // 等待下载完成
            await waitSync(5000);

            // 将下载的文件移动到指定目录
            await moveLatestReceipt(downloadPath, savePath);

            console.log(`合同号: ${contractID}，信息整理完成`);

            await page.reload({
                waitUntil: 'networkidle2' // 等待页面完全加载
            })
        }

        // 读取 Excel 文件
        const workbook = XLSX.readFile(`./${excelPath}.xlsx`);

        const worksheet = workbook.Sheets['Sheet1'];

        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 提取合同号
        const contractIDs = data.map(row => row[0]).filter(Boolean);

        if (contractIDs.length > 0) {
            console.log(`共有 ${contractIDs.length - 1} 个合同号开始处理`);
            for (const contractID of contractIDs) {
                const index = contractIDs.indexOf(contractID);
                if (index === 0) continue;

                try {
                    await handlePage(contractID, `${targetDir}\\${index}`);
                } catch (error) {
                    console.error(`处理合同号 ${contractID} 失败:`, error.message);

                    // 处理失败时，继续处理下一个合同号
                    await page.reload({ waitUntil: 'networkidle2' });

                    continue;
                }
            }
        }

    } catch (error) {
        console.error('操作失败:', error);
    } finally {
        // 调试时可注释关闭
        // await browser.close();
    }
})();