const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function downloadImage(url, targetDir) {
    const parsedUrl = new URL(url);
    const filename = path.basename(parsedUrl.pathname) || 'default.jpg';
    const filePath = path.join(targetDir, filename);

    try {
        console.log(`开始下载: ${filename}`);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*'
            }
        });

        // 直接将 Buffer 写入文件
        await fs.promises.writeFile(filePath, response.data);

        const fileSize = (response.data.length / 1024 / 1024).toFixed(2);
        console.log(`下载完成: ${filename} (${fileSize} MB)`);
        return filePath;

    } catch (error) {
        console.error(`下载失败: ${filename}`, error.message);

        // 修复：使用正确的文件清理方式
        try {
            await fs.promises.access(filePath);
            await fs.promises.unlink(filePath);
            console.log(`已清理不完整文件: ${filename}`);
        } catch (unlinkError) {
            // 文件不存在或其他错误，忽略
        }

        throw error;
    }
}


// 下载所有图片
async function downloadAllImages(urls, targetDir) {
    await fs.promises.mkdir(targetDir, { recursive: true });
    await Promise.allSettled(
        urls.map(url =>
            downloadImage(url, targetDir)
                .then(() => console.log(`成功: ${url}`))
                .catch(err => console.error(`失败: ${url}，原因: ${err.message}`))
        )
    );
}

/**
 * 寻找目录中符合命名规则且修改时间最新的文件
 * @param {string} sourceDir 源目录路径
 * @returns {Promise<string|null>} 最新文件名（无路径）
 */
async function findLatestElectronicReceipt(sourceDir) {
    try {
        const files = fs.readdirSync(sourceDir);

        // 正则匹配文件名：电子回单.pdf、电子回单(1).pdf 等
        const pattern = /^电子回单(?:\(\d+\))?\.pdf$/i;
        const matchedFiles = files.filter(file => pattern.test(file));

        if (matchedFiles.length === 0) {
            console.log('[提示] 目录中未找到符合条件的电子回单文件');
            return null;
        }

        // 获取所有匹配文件的修改时间
        const filesWithStats = await Promise.all(
            matchedFiles.map(async (file) => {
                const filePath = path.join(sourceDir, file);
                const stats = fs.statSync(filePath);
                return { file, mtimeMs: stats.mtimeMs };
            })
        );

        // 找到时间戳最大的文件
        const latest = filesWithStats.reduce((prev, curr) =>
            prev.mtimeMs > curr.mtimeMs ? prev : curr
        );

        return latest.file;
    } catch (error) {
        console.error('[错误] 查找文件失败:', error.message);
        throw error;
    }
}

/**
 * 移动最新文件到目标目录
 * @param {string} sourceDir 源目录
 * @param {string} targetDir 目标目录
 */
async function moveLatestReceipt(sourceDir, targetDir) {
    try {
        const fileName = await findLatestElectronicReceipt(sourceDir);
        if (!fileName) return;

        const sourcePath = path.join(sourceDir, fileName);
        const targetPath = path.join(targetDir, '电子回单.pdf');

        // 确保目标目录存在
        fs.mkdirSync(targetDir, { recursive: true });

        try {
            // 尝试直接移动（同磁盘分区）
            await fs.renameSync(sourcePath, targetPath);
            console.log(`✅ 成功移动文件: ${fileName} → ${targetDir}`);
        } catch (error) {
            if (error.code === 'EXDEV') {
                // 跨磁盘操作：复制后删除原文件
                await fs.copyFileSync(sourcePath, targetPath);
                await fs.unlinkSync(sourcePath);
                console.log(`✅ 跨磁盘移动完成: ${fileName} → ${targetDir}`);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('[错误] 移动文件失败:', error.message);
    }
}

module.exports = {downloadAllImages, moveLatestReceipt}