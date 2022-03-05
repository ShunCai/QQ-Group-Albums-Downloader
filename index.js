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
// @require      https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js
// @require      https://open.thunderurl.com/thunder-link.js
// @require      https://cdn.jsdelivr.net/npm/clipboard@2.0.10/dist/clipboard.min.js
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

    // 创建相册前插入按钮
    let $createBtn = document.getElementById('js_create_album_btn');
    if (!$createBtn) {
        return;
    }

    // 替换文件名称的特殊字符
    const replaceFileName = (name) => {
        return name.replace(/'|#|~|&| |!|\\|\/|:|\?|"|<|>|\*|\|/g, "_");
    }

    // 下载文件
    const download = async(albums) => {
        for (const ablum of albums) {

            // 创建A标签
            const downLink = document.createElement('a');
            downLink.download = replaceFileName(ablum.name) + '.zip';
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
    const invokeThunder = (albums) => {
        // 迅雷下载任务
        const thunderTask = [];
        for (const album of albums) {
            thunderTask.push({
                name: replaceFileName(album.name) + '.zip',
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

        if (!Thunder.pId) {
            copyToClipboard('thunderx://' + JSON.stringify(thunderInfo));
            return;
        }
        thunderLink.newTask(thunderInfo);
    }

    // 复制文本到剪切板
    const copyToClipboard = (text) => {
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
        return new Promise((res, rej) => {
            // 执行复制命令并移除文本框
            document.execCommand('copy') ? res() : rej();
            textArea.remove();
        });
    }

    // 复制相册下载地址
    const copyAlbumUrls = (albums) => {
        const urls = [];
        for (const album of albums) {
            urls.push(album.downloadUrl);
        }
        copyToClipboard(urls.join('\n'));
    }

    // 获取下载URL
    var getDownloadUrl = (albumId, albumName) => new Promise((resolve, reject) => {

        // 请求下载地址参数
        const params = {
            uin: PSY.user.getLoginUin(),
            hostUin: -1,
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            refer: 'qzone',
            source: 'qzone',
            format: 'json',
            appid: 422,
            selectMode: 1,
            albumid: albumId,
            hostid: getQueryString('groupId'),
            albumName: albumName
        }

        // 请求下载地址
        const url = 'https://h5.qzone.qq.com/proxy/domain/app.photo.qq.com/cgi-bin/app/cgi_arch_photo_v2?g_tk=' + PSY.user.token() + '&qzonetoken=' + window.g_qzonetoken;
        $.post(url, params, function(data, status, xhr) {
            if (status === 'success') {
                resolve(data);
            } else {
                reject(xhr);
            }
        }, 'json');
    })

    // 获取相册信息
    const getAlbumList = () => {

        // 所有相册
        const nodeList = document.querySelectorAll('#groupzone_album_list > li');

        // 相册信息
        const albums = [];

        for (const node of nodeList) {
            // 相册名称
            const albumName = node.querySelector('div > div.ft > div.album-name > h4 > a').innerText;
            // 相册ID
            const albumId = node.getAttribute("data-id");
            albums.push({
                id: albumId,
                name: albumName
            });
        }
        return albums;
    }

    // 获取相册下载链接
    const getDownloadLinks = async(albums) => {
        for (const album of albums) {

            // 获取相册下载地址
            await getDownloadUrl(album.id, album.name).then((data) => {
                album.downloadUrl = data.data.downloadUrl;
            })

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
            window.albums = getAlbumList();
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
    $createBtn.parentElement.appendChild($downloadBtn);

    // 迅雷下载
    const $thunderBtn = document.createElement('a');
    $thunderBtn.innerText = '迅雷下载';
    $thunderBtn.setAttribute('title', '唤醒迅雷进行下载，需要安装迅雷，如无法正常唤醒，可先启动迅雷并打开剪切板监听，或直接复制链接到迅雷下载');
    $thunderBtn.setAttribute('class', 'mod-btn-upload');
    $thunderBtn.style.cssText = "background-color: #5b63dd;border-color: #5b63dd;margin-left: 10px;";
    $thunderBtn.addEventListener("click", async function() {

        // 获取相册列表
        if (!window.albums) {
            this.innerText = '获取下载链接...';
            window.albums = getAlbumList();
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
    $createBtn.parentElement.appendChild($thunderBtn);

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
            window.albums = getAlbumList();
            await getDownloadLinks(window.albums);
        }

        this.innerText = '正在复制';

        // 复制到剪切板
        copyAlbumUrls(albums);

        this.innerText = '复制完成';

        setTimeout(() => {
            this.innerText = '复制链接';
        }, 1500);
    })
    $createBtn.parentElement.appendChild($copyLinks);

})();