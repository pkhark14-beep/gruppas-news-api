const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

const PORT = process.env.PORT || 3000;
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL ? process.env.TELEGRAM_CHANNEL.replace('@', '') : 'gruppasnews';

// База истории постов канала (сюда можно вписать все важные старые посты)
let fullHistoryPosts = [
    {
        id: "96",
        date: "2 ноября 2026 г.",
        text: "67",
        photo: null
    },
    {
        id: "50",
        date: "28 октября 2026 г.",
        text: "Слышали про Minecraft на Rust/Vulkan, который летает даже на микроволновке? Делаем свой Gruppas Edition на смартфоны и ПК после релиза лаунчера 1.0.3 и визуалов?\n\n💬 Что планируется:\n• Полная мобильность: Полноценный запуск на смартфонах (Android/iOS)!\n• Интерфейс Bedrock: Привычное меню, удобное управление и гибкая настройка мира.\n• Поддержка Java-модов: Возможность запускать .jar моды простым переименованием файла в проводнике.",
        photo: null
    }
];

app.get('/api/news', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    
    try {
        const url = `https://t.me/s/${CHANNEL_USERNAME}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        $('.tgme_widget_message').each((i, element) => {
            const $el = $(element);
            const postUrl = $el.find('.tgme_widget_message_date').attr('href') || '';
            const postIdMatch = postUrl.match(/\/(\d+)(\?|$)/);
            if (!postIdMatch) return;
            const postId = postIdMatch[1];

            const dateStr = $el.find('.tgme_widget_message_date time').attr('datetime') || '';
            let formattedDate = 'Недавно';
            if (dateStr) {
                formattedDate = new Date(dateStr).toLocaleDateString('ru-RU', { 
                    day: 'numeric', month: 'long', year: 'numeric' 
                });
            }

            let text = $el.find('.tgme_widget_message_text').html();
            if (text) {
                text = text.replace(/<br\s*[\/]?>/gi, '\n');
            } else {
                text = $el.find('.tgme_widget_message_poll_question').text() || 'Медиа-пост / Опрос';
            }
            const cleanText = $('<div>').html(text).text();

            let photoUrl = null;
            const $photoStyle = $el.find('.tgme_widget_message_photo_wrap');
            if ($photoStyle.length) {
                const styleAttr = $photoStyle.attr('style') || '';
                const match = styleAttr.match(/url\('(.*?)'\)/);
                if (match && match[1]) photoUrl = match[1];
            }

            if (cleanText || photoUrl) {
                const existingIndex = fullHistoryPosts.findIndex(p => p.id === postId);
                if (existingIndex !== -1) {
                    fullHistoryPosts[existingIndex] = { id: postId, date: formattedDate, text: cleanText, photo: photoUrl };
                } else {
                    fullHistoryPosts.unshift({ id: postId, date: formattedDate, text: cleanText, photo: photoUrl });
                }
            }
        });

        fullHistoryPosts.sort((a, b) => Number(b.id) - Number(a.id));
        res.json(fullHistoryPosts);
    } catch (e) {
        console.error('Ошибка парсинга:', e.message);
        res.json(fullHistoryPosts);
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
