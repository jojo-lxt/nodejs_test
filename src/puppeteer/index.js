import puppeteer from "puppeteer-core";
import fs from "fs";
import {downloadAllImages, moveLatestReceipt} from "./functions.js";
import XLSX from "xlsx";

// 程序运行时等待函数
const waitSync = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const excelPath = "C:\\Users\\13478\\Documents\\WeChat Files\\wxid_r5g8r67hoepn22\\FileStorage\\File\\2025-04\\租赁案件.xlsx";

const targetDir = "C:\\Users\\13478\\Desktop\\一汽系统下载";

(async () => {
    // 启动浏览器（调试时可关闭无头模式）
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: false,  // 设为 true 则隐藏浏览器界面
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 读取保存的cookies
    const cookiesText = fs.readFileSync('./cookies.json', 'utf-8');
    const cookies = JSON.parse(cookiesText);

    await browser.setCookie(...cookies);

    // 打开新页面
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 800 });

    try {
        await page.goto('https://apmcv.17ebank.com:9117/dsp/', {
            waitUntil: 'networkidle2' // 等待页面完全加载
        });

        // 读取保存的localStorage
        const localStorageData = fs.readFileSync('./local_storage.json', 'utf-8');

        await page.evaluate((data) => {
            const parsedData = JSON.parse(data);
            for (const key in parsedData) {
                localStorage.setItem(key, parsedData[key]);
            }
        }, localStorageData);

        await page.reload({
            waitUntil: 'networkidle2' // 等待页面完全加载
        })

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
            await waitSync(3000)

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
            await moveLatestReceipt("C:\\Users\\13478\\Downloads", savePath);

            console.log(`合同号: ${contractID}，信息整理完成`);

            await page.reload({
                waitUntil: 'networkidle2' // 等待页面完全加载
            })
        }

        // 读取 Excel 文件
        const workbook = XLSX.readFile(excelPath);

        const worksheet = workbook.Sheets['Sheet1'];

        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 提取合同号
        const contractIDs = data.map(row => row[0]).filter(Boolean);

        if (contractIDs.length > 0) {
            console.log(`共有 ${contractIDs.length} 个合同号开始处理`);
            for (const contractID of contractIDs) {
                const index = contractIDs.indexOf(contractID) + 15;
                if (index !== 0) {
                    await handlePage(contractID, `${targetDir}\\${index}`);
                }
            }
        }

    } catch (error) {
        console.error('操作失败:', error.message);
    } finally {
        // 8. 关闭浏览器
        // await browser.close();
    }
})();