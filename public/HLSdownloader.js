let downloadedTsFiles = 0;
let totalTsFiles = 0;

const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const downloadStatus = document.getElementById('downloadStatus');

let is_downloading = false;

async function downloadHLS(m3u8Url = '', name = 'test_anime') {
    if (is_downloading) {
        return;
    }
    is_downloading = true;
    progressContainer.style.display = 'block';
    downloadStatus.textContent = '正在解析m3u8文件...';
    try {
        const m3u8Content = await getM3u8Content(m3u8Url);
        console.log(m3u8Content);

        // 解析ts文件路径
        const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        const tsUrls = m3u8Content.match(/^(?!#).*\.ts$/gm).map(ts => new URL(ts, baseUrl).href);

        // 获取视频总时长
        let durationSecond= 0;
        m3u8Content.split('\n').forEach(item => {
            if (item.toUpperCase().indexOf('#EXTINF:') > -1) { // 计算视频总时长，设置 mp4 信息时使用
                durationSecond += parseFloat(item.split('#EXTINF:')[1])
            }
        })
        console.log('durationSecond:', durationSecond);

        // 如果m3u8文件包含加密信息，提取key和iv
        const keyInfo = await getM3u8Key(m3u8Content, baseUrl);

        if (!tsUrls) {
            throw new Error('No .ts files found in the m3u8 file.');
        }

        totalTsFiles = tsUrls.length;
        downloadedTsFiles = 0;
        downloadStatus.textContent = '正在下载切片文件...';
        let segments = await Promise.all(tsUrls.map(url => downloadSegment(url)));

        // 如果m3u8文件包含加密信息，解密ts文件
        if (keyInfo) {
            downloadStatus.textContent = '正在解密文件...';
            segments = await Promise.all(segments.map(segment => decryptTS(segment, keyInfo.key, keyInfo.iv)));
        }

        downloadStatus.textContent = '正在合并文件...';
        // const combinedBuffer = concatenate(segments);

        // 使用 mux.js 解析 TS 文件
        const transmuxer = new muxjs.Transmuxer(
            {
                keepOriginalTimestamps: true,
                duration: parseInt(durationSecond),
            }
        );
        const mp4Segments = [];
        let baseMediaDecodeTime = 0;

        // transmuxer.on('data', (segment) => {
        //     mp4Segments.push(segment.initSegment);
        //     mp4Segments.push(segment.data);
        // });
        let index = 0;
        transmuxer.on('data', segment => {
            if (index === 0) {
              let data = new Uint8Array(segment.initSegment.byteLength + segment.data.byteLength);
              data.set(segment.initSegment, 0);
              data.set(segment.data, segment.initSegment.byteLength);
              mp4Segments.push(data.buffer);
            } else {
                mp4Segments.push(segment.data);
            }
          });
        for (const segment of segments) {
            transmuxer.push(segment);
            transmuxer.flush();
            index++;
        }
        // transmuxer.push(combinedBuffer);
        // transmuxer.flush();

        const mp4Blob = new Blob(mp4Segments, { type: 'video/mp4' });
        // 下载 MP4 文件
        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);

        downloadStatus.textContent = '下载完成';
        is_downloading = false;
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            downloadStatus.textContent = '';
        }, 3000);

    } catch (error) {
        console.error('Error downloading video:', error);
        is_downloading = false;
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        downloadStatus.textContent = 'Error downloading video:' + error;
    }
}

// 如果m3u8文件包含其他m3u8url，需要递归下载
async function getM3u8Content(m3u8Url) {
    try {
        const response = await fetch('/proxy?url=' + encodeURIComponent(m3u8Url));
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const m3u8Content = await response.text();
        console.log(m3u8Content);

        // 解析ts文件路径
        const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        let m3u8Urls = m3u8Content.match(/^(?!#).*\.m3u8$/gm);
        if (m3u8Urls) {
            console.log('Found another m3u8 file:', m3u8Urls);
            m3u8Urls = m3u8Urls.map(m3u8 => (new URL(m3u8, baseUrl)).href);
            return getM3u8Content(m3u8Urls[0]);
        }
        return m3u8Content;
    } catch (error) {
        console.log('Error getting m3u8:', error);
        downloadStatus.textContent = '下载m3u8文件失败';
        throw new Error('Failed to download m3u8 file');
    }
}

// 如果m3u8文件包含加密信息，提取key和iv
async function getM3u8Key(m3u8Content, baseUrl) {
    try {
        const keyLine = m3u8Content.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"(?:,IV=0x([0-9A-Fa-f]+))?/);
        if (keyLine) {
            const keyUrl = new URL(keyLine[1], baseUrl).href;
            const ivHex = keyLine[2];
            const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const keyResponse = await fetch('/proxy?url=' + encodeURIComponent(keyUrl));
            if (!keyResponse.ok) {
                throw new Error('Network response was not ok');
            }
            const key = new Uint8Array(await keyResponse.arrayBuffer());
            return { key, iv };
        }
        else {
            // 如果没有key，返回null
            return null;
        }
    } catch (error) {
        console.log('Error getting key:', error);
        downloadStatus.textContent = '下载key文件失败';
        throw new Error('Failed to download key file');
    }
}

async function downloadSegment(url, retries = 5) {
    try {
        const response = await fetch(`/proxy?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const arrayBuffer = await response.arrayBuffer();
        updateProgress();
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        if (retries > 0) {
            console.error(`Error downloading segment, retrying... (${retries} retries left)`);
            return downloadSegment(url, retries - 1);
        } else {
            throw new Error('Failed to download segment');
        }
    }
}

async function decryptTS(data, key, iv) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
    );
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: iv },
        cryptoKey,
        data
    );
    return new Uint8Array(decryptedBuffer);
}

function updateProgress() {
    downloadedTsFiles++;
    const progress = (downloadedTsFiles / totalTsFiles) * 100;
    progressBar.style.width = `${progress}%`;
}

function concatenate(arrays) {
    let totalLength = 0;
    for (const arr of arrays) {
        totalLength += arr.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    console.log(totalLength);
    return result;
}
