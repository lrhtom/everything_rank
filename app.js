const AI_API_KEY = "sk-e01f84fe67424e5dbebce5b3b4f8d095";
const AI_MODEL = "deepseek-v4-flash";
const API_URL = "https://api.deepseek.com/chat/completions";

document.addEventListener('DOMContentLoaded', () => {
    const topicInput = document.getElementById('topicInput');
    const countInput = document.getElementById('countInput');
    const countValue = document.getElementById('countValue');
    const generateBtn = document.getElementById('generateBtn');
    const btnText = generateBtn.querySelector('.btn-text');
    const loader = generateBtn.querySelector('.loader');
    const resultSection = document.getElementById('resultSection');
    const exportWrapper = document.getElementById('exportWrapper');
    const rankingTitle = document.getElementById('rankingTitle');
    const exportBtn = document.getElementById('exportBtn');
    const captureArea = document.getElementById('captureArea');

    // 监听数量变化并实时更新数字徽章
    countInput.addEventListener('input', (e) => {
        countValue.textContent = e.target.value;
    });

    generateBtn.addEventListener('click', async () => {
        const topic = topicInput.value.trim();
        const count = countInput.value;

        if (!topic) {
            alert("请输入你想排名的主题！");
            topicInput.focus();
            return;
        }

        const loadingOverlay = document.getElementById('loadingOverlay');

        // 设置加载状态
        generateBtn.disabled = true;
        loadingOverlay.classList.remove('hidden'); // 显示全屏加载
        resultSection.innerHTML = '';
        exportWrapper.classList.add('hidden'); // 隐藏旧结果包装器

        try {
            const results = await fetchRanking(topic, count);
            rankingTitle.textContent = `关于“${topic}”的 Top ${count} 排名`;
            exportBtn.style.display = 'inline-flex'; // 成功时显示导出按钮
            renderResults(results);
            exportWrapper.classList.remove('hidden'); // 渲染完成后显示
        } catch (error) {
            console.error("Fetch Error:", error);
            rankingTitle.textContent = "生成失败";
            exportBtn.style.display = 'none'; // 失败时隐藏导出按钮
            resultSection.innerHTML = `
                <div class="error-message">
                    <p>${error.message || "未知错误，请检查网络或稍后再试。"}</p>
                </div>
            `;
            exportWrapper.classList.remove('hidden');
        } finally {
            // 恢复按钮状态
            generateBtn.disabled = false;
            loadingOverlay.classList.add('hidden'); // 隐藏全屏加载
        }
    });

    exportBtn.addEventListener('click', async () => {
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = "正在生成图片...";
        exportBtn.disabled = true;

        // 增加 exporting 类，强制关闭所有卡片动画，确保 html2canvas 截屏元素是最终形态
        captureArea.classList.add('exporting');

        try {
            // 使用 html2canvas 截取 captureArea 区域
            const canvas = await html2canvas(captureArea, {
                backgroundColor: "#0f172a", // 强制深色背景以避免透明发白
                scale: 2 // 提高清晰度
            });
            const imgData = canvas.toDataURL('image/png');
            
            // 触发下载
            const link = document.createElement('a');
            const safeTopic = topicInput.value.trim().replace(/[\/\\?%*:|"<>]/g, '-');
            link.download = `${safeTopic}_排名.png`;
            link.href = imgData;
            link.click();
        } catch (err) {
            console.error("导出图片失败:", err);
            alert("导出图片失败，请稍后再试。");
        } finally {
            captureArea.classList.remove('exporting');
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;
        }
    });

    async function fetchRanking(topic, count) {
        // 构建严格返回 JSON 的 Prompt
        const prompt = `You are an expert ranking assistant. The user wants a top ${count} ranking for the topic: "${topic}".
You must provide the most reasonable, objective, and widely accepted ranking.
**CRITICAL**: You must respond in Chinese language (简体中文) for all text fields.
Respond strictly in JSON format. The root must be a JSON array. 
Each object in the array must have exactly the following keys:
- "rank": integer (from 1 to ${count})
- "name": string (the name of the item in Chinese)
- "score": string (an optional metric or score representing its value, e.g., "9.8/10", "SS级", "98分")
- "reason": string (a short, engaging 1-2 sentence explanation in Chinese of why it earned this rank)

Do NOT wrap the JSON in markdown code blocks like \`\`\`json. Just output the raw JSON array.`;

        const requestBody = {
            model: AI_MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        
        // 解析返回的 JSON 字符串
        let textContent = data.choices[0].message.content;
        
        // 尝试去除可能的 markdown 代码块标记，以防万一
        textContent = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        try {
            return JSON.parse(textContent);
        } catch (e) {
            throw new Error("AI 返回了无法解析的内容，请重试。");
        }
    }

    function renderResults(results) {
        resultSection.innerHTML = '';
        
        if (!Array.isArray(results) || results.length === 0) {
            resultSection.innerHTML = '<div class="error-message">未能获取到有效的排名数据。</div>';
            return;
        }

        // 确保按照排名排序
        results.sort((a, b) => a.rank - b.rank);

        results.forEach((item, index) => {
            // 错开动画延迟，实现瀑布流渐现效果
            const delay = index * 0.1; 
            
            const card = document.createElement('div');
            card.className = 'rank-card';
            card.setAttribute('data-rank', item.rank);
            card.style.animationDelay = `${delay}s`;

            card.innerHTML = `
                <div class="rank-number">#${item.rank}</div>
                <div class="rank-content">
                    <h3 class="rank-title">${item.name}</h3>
                    ${item.score ? `<div class="rank-score">${item.score}</div>` : ''}
                    <p class="rank-reason">${item.reason}</p>
                </div>
            `;
            
            resultSection.appendChild(card);
        });
    }
});
