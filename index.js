const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

const PORT = process.env.PORT || 3000;
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL ? process.env.TELEGRAM_CHANNEL.replace('@', '') : 'gruppasnews';

// Сюда ты можешь в любой момент дописать старые важные посты вручную, 
// чтобы они навсегда остались на сайте вместе со свежими
let manualOldPosts = [
    {
        id: "1", // Пример ID старого поста
        date: "28 октября 2026 г.",
        text: "Слышали про Minecraft на Rust/Vulkan, который летает даже на микроволновке? Делаем свой Gruppas Edition на смартфоны и ПК после релиза лаунчера 1.0.3 и визуалов?\n\n💬 Что планируется:\n• Полная мобильность: Полноценный запуск на смартфонах (Android/iOS)!\n• Интерфейс Bedrock: Привычное меню, удобное управление и гибкая настройка мира.\n• Поддержка Java-модов: Возможность запускать .jar моды простым переименованием файла в проводнике.",
        photo: null // Сюда можно вставить прямую ссылку на картинку, если она была в посте
    }
];

app.get('/api/news', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    
    try {
        const url = `https://t.me/s/${CHANNEL_USERNAME}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        let scrapedPosts = [];

        $('.tgme_widget_message').each((i, element) => {
            const $el = $(element);
            
            // ID поста из ссылки
            const postUrl = $el.find('.tgme_widget_message_date').attr('href') || '';
            const postIdMatch = postUrl.match(/\/(\d+)(\?|$)/);
            const postId = postIdMatch ? postIdMatch[1] : String(i);

            // Дата поста
            const dateStr = $el.find('.tgme_widget_message_date time').attr('datetime') || '';
            let formattedDate = 'Недавно';
            if (dateStr) {
                formattedDate = new Date(dateStr).toLocaleDateString('ru-RU', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                });
            }

            // Текст поста
            let text = $el.find('.tgme_widget_message_text').html();
            if (text) {
                text = text.replace(/<br\s*[\/]?>/gi, '\n');
            } else {
                text = $el.find('.tgme_widget_message_poll_question').text() || 'Медиа-пост / Опрос';
            }
            const cleanText = $('<div>').html(text).text();

            // Картинка поста (если есть)
            let photoUrl = null;
            const $photoStyle = $el.find('.tgme_widget_message_photo_wrap');
            if ($photoStyle.length) {
                const styleAttr = $photoStyle.attr('style') || '';
                const match = styleAttr.match(/url\('(.*?)'\)/);
                if (match && match[1]) {
                    photoUrl = match[1];
                }
            }

            if (cleanText || photoUrl) {
                scrapedPosts.push({
                    id: postId,
                    date: formattedDate,
                    text: cleanText,
                    photo: photoUrl
                });
            }
        });

        // Объединяем ручные старые посты и автоматически спарсенные (исключая дубликаты по id)
        const allPostsMap = new Map();
        
        // Сначала добавляем автоматически собранные
        scrapedPosts.forEach(p => allPostsMap.set(p.id, p));
        
        // Затем добавляем ручные (если их еще нет)
        manualOldPosts.forEach(p => {
            if (!allPostsMap.has(p.id)) {
                allPostsMap.set(p.id, p);
            }
        });

        let finalPosts = Array.from(allPostsMap.values());

        // Сортируем по ID (в Telegram новые посты имеют больший ID)
        finalPosts.sort((a, b) => Number(b.id) - Number(a.id));

        res.json(finalPosts);
    } catch (e) {
        console.error('Ошибка парсинга:', e);
        // Если что-то пойдет не так, отдадим хотя бы ручные старые посты, чтобы сайт не был пустым
        res.json(manualOldPosts);
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
