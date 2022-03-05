// ==UserScript==
// @name         QQ群相册批量下载
// @namespace    http://lvshuncai.com
// @homepage     https://github.com/ShunCai/QQ-Group-Albums-Downloader
// @version      1.0
// @description  自动点击QQ群相册的下载功能，实现所有的群相册的批量下载
// @author       芷炫
// @match        https://h5.qzone.qq.com/groupphoto/index?inqq=*&groupId=*
// @match        https://h5.qzone.qq.com/groupphoto/album?inqq=*&groupId=*
// @icon         https://qzonestyle.gtimg.cn/aoi/img/logo/favicon.ico
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 获取查询参数
    var getQueryString = function(name) {
        let reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
        let r = window.location.search.substring(1).match(reg);
        if (r != null) {
            return decodeURI(r[2]);
        };
        return null;
    }

    // 延迟函数
    var delay = milliseconds => new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });

    // 上传相片按钮
    let $uploadBtn = document.querySelector('#js_pic_upload_btn,#js-header-upload')
    if (!$uploadBtn) {
        return;
    }

    // 替换文件名称的特殊字符
    const replaceFileName = name => {
        return name.replace(/'|#|~|&| |!|\\|\/|:|\?|"|<|>|\*|\|/g, "_");
    }

    // 下载文件
    const download = async albums => {
        for (const ablum of albums) {

            // 创建A标签
            const downLink = document.createElement('a');
            downLink.download = replaceFileName(ablum.title) + '.zip';
            downLink.href = ablum.downloadUrl.replace('http:', 'https:');
            downLink.style.display = 'none';
            document.body.append(downLink);

            // 模拟点击
            downLink.click();

            // Chrome requires the timeout
            await delay(1000);

            // 移除A标签
            downLink.remove();

        }
    }

    // 迅雷下载
    const invokeThunder = albums => {
        // 迅雷下载任务
        const thunderTask = [];
        for (const album of albums) {
            thunderTask.push({
                name: replaceFileName(album.title) + '.zip',
                url: album.downloadUrl
            })
        }

        // 迅雷下载信息
        const thunderInfo = {
            taskGroupName: 'QQ群相册_' + getQueryString('groupId'),
            hideYunPan: '0',
            referer: 'https://h5.qzone.qq.com/',
            tasks: thunderTask
        }

        copyToClipboard('thunderx://' + JSON.stringify(thunderInfo));
    }

    // 复制文本到剪切板
    const copyToClipboard = async text => {
        navigator.clipboard.writeText(text).catch((error) => {

            console.error('异步复制失败', error);

            // 创建text area
            let textArea = document.createElement("textarea");
            textArea.value = text;
            // 使text area不在viewport，同时设置不可见
            textArea.style.position = "absolute";
            textArea.style.opacity = 0;
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            // 执行复制命令并移除文本框
            document.execCommand('copy') ? res() : rej();
            textArea.remove();
        });
    }

    // 复制相册下载地址
    const copyAlbumUrls = async albums => {
        const urls = [];
        for (const album of albums) {
            urls.push(album.downloadUrl);
        }
        await copyToClipboard(urls.join('\n'));
    }

    // 获取下载URL
    var getDownloadUrl = async album => {
        // 请求地址参数
        const urlParmas = new URLSearchParams();
        urlParmas.append('g_tk', PSY.user.token());
        urlParmas.append('qzonetoken', window.g_qzonetoken);
        // 请求实体参数
        const bodyParmas = new URLSearchParams();
        bodyParmas.append('uin', PSY.user.getLoginUin());
        bodyParmas.append('hostUin', -1);
        bodyParmas.append('inCharset', 'utf-8');
        bodyParmas.append('outCharset', 'utf-8');
        bodyParmas.append('refer', 'refer');
        bodyParmas.append('source', 'qzone');
        bodyParmas.append('platform', 'qzone');
        bodyParmas.append('format', 'json');
        bodyParmas.append('appid', 422);
        bodyParmas.append('selectMode', 1);
        bodyParmas.append('albumid', album.id);
        bodyParmas.append('hostid', getQueryString('groupId'));
        bodyParmas.append('albumName', album.title);
        const response = await fetch('https://h5.qzone.qq.com/proxy/domain/app.photo.qq.com/cgi-bin/app/cgi_arch_photo_v2?' + urlParmas.toString(), {
            method: 'POST',
            body: bodyParmas
        });
        return await response.json();
    }

    // 相册每页条目数
    const ALBUMNS_PAGE_SIZE = 2;

    // 获取相册信息
    const getAlbumInfo = async(page) => {
        const parmas = new URLSearchParams();
        parmas.append('g_tk', PSY.user.token());
        parmas.append('qzonetoken', window.g_qzonetoken);
        parmas.append('qunId', getQueryString('groupId'));
        parmas.append('uin', PSY.user.getLoginUin());
        parmas.append('start', page * ALBUMNS_PAGE_SIZE);
        parmas.append('num', ALBUMNS_PAGE_SIZE);
        parmas.append('format', 'json');
        parmas.append('inCharset', 'utf-8');
        parmas.append('outCharset', 'utf-8');
        parmas.append('platform', 'qzone');
        parmas.append('source', 'qzone');
        parmas.append('cmd', 'qunGetAlbumList');
        const response = await fetch('https://h5.qzone.qq.com/proxy/domain/u.photo.qzone.qq.com/cgi-bin/upp/qun_list_album_v2?' + parmas.toString());
        return await response.json();
    }

    // 获取相册信息
    const getAlbumList = async() => {
        window.albums = [];

        // 获取第一页相册 
        const albumInfo = await getAlbumInfo(0);
        window.albums.push(...albumInfo.data.album || []);

        // 相册个数
        const total = albumInfo.data.total;
        if (total > ALBUMNS_PAGE_SIZE) {
            for (let page = 1; page * ALBUMNS_PAGE_SIZE < total; page++) {
                const pageAlbumInfo = await getAlbumInfo(page);
                window.albums.push(...pageAlbumInfo.data.album || []);
                await delay(1500);
            }
        }

        return window.albums;
    }

    // 获取相册下载链接
    const getDownloadLinks = async albums => {
        for (const album of albums) {

            // 获取相册下载地址
            const downloadInfo = await getDownloadUrl(album);
            album.downloadUrl = downloadInfo.data.downloadUrl;

            // 延迟
            await delay(1000);
        }
    }

    // 批量下载
    const $downloadBtn = document.createElement('a');
    $downloadBtn.innerText = '批量下载';
    $downloadBtn.setAttribute('class', 'mod-btn-upload');
    $downloadBtn.setAttribute('title', '直接通过浏览器自身下载全部相册，相册过多时，下载容易出错，建议自行复制链接到第三方工具下载');
    $downloadBtn.style.cssText = "background-color: #dd905b;border-color: #dd905b;margin-left: 10px;";
    $downloadBtn.addEventListener("click", async function() {

        // 获取相册列表
        if (!window.albums) {
            this.innerText = '获取下载链接...';
            window.albums = await getAlbumList();
            await getDownloadLinks(window.albums);
        }

        this.innerText = '正在下载';

        // 浏览器下载
        await download(albums);

        this.innerText = '下载完成';

        setTimeout(() => {
            this.innerText = '批量下载';
        }, 1500);
    })
    $uploadBtn.parentElement.appendChild($downloadBtn);

    // 迅雷下载
    const $thunderBtn = document.createElement('a');
    $thunderBtn.innerText = '迅雷下载';
    $thunderBtn.setAttribute('title', '需先安装迅雷，并打开迅雷，以及打开剪切板监听，或直接复制链接到迅雷下载');
    $thunderBtn.setAttribute('class', 'mod-btn-upload');
    $thunderBtn.style.cssText = "background-color: #5b63dd;border-color: #5b63dd;margin-left: 10px;";
    $thunderBtn.addEventListener("click", async function() {

        // 获取相册列表
        if (!window.albums) {
            this.innerText = '获取下载链接...';
            window.albums = await getAlbumList();
            await getDownloadLinks(window.albums);
        }

        this.innerText = '正在唤醒迅雷';

        // 迅雷下载
        invokeThunder(albums);

        this.innerText = '已唤醒迅雷';

        setTimeout(() => {
            this.innerText = '迅雷下载';
        }, 1500);
    })
    $uploadBtn.parentElement.appendChild($thunderBtn);

    // 复制链接
    const $copyLinks = document.createElement('a');
    $copyLinks.innerText = '复制链接';
    $copyLinks.setAttribute('title', '复制下载链接到剪切板，可以自行到迅雷、IDM等第三方工具下载，建议尽快下载，避免存在有效期');
    $copyLinks.setAttribute('class', 'mod-btn-upload');
    $copyLinks.style.cssText = "background-color: #5bdd6b;border-color: #5bdd6b;margin-left: 10px;";
    $copyLinks.addEventListener("click", async function() {

        // 获取相册列表
        if (!window.albums) {
            this.innerText = '获取下载链接...';
            window.albums = await getAlbumList();
            await getDownloadLinks(window.albums);
        }

        this.innerText = '正在复制';

        // 复制到剪切板
        await copyAlbumUrls(albums);

        this.innerText = '复制完成';

        setTimeout(() => {
            this.innerText = '复制链接';
        }, 1500);
    })
    $uploadBtn.parentElement.appendChild($copyLinks);

})();