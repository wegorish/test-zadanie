# «ОфисСклад»: скриншоты до и после

Демо-копия: `kanctovar/`. «До» — ветка `main`, «после» — ветка `redesign-ux`.

Снимки сделаны headless Chrome на ширине 1280 и 390 px, без входа в аккаунт, с пустой корзиной.
Мобильные снимки выше одного экрана телефона (844 px), чтобы был виден весь блок; первый экран — это верхние 844 px.

| Страница | 1280 px до | 1280 px после | 390 px до | 390 px после |
|---|---|---|---|---|
| Главная | ![](screens/before/home-1280.jpg) | ![](screens/after/home-1280.jpg) | ![](screens/before/home-390.jpg) | ![](screens/after/home-390.jpg) |
| Раздел «Календари» | ![](screens/before/section-1280.jpg) | ![](screens/after/section-1280.jpg) | ![](screens/before/section-390.jpg) | ![](screens/after/section-390.jpg) |
| Карточка товара | ![](screens/before/product-1280.jpg) | ![](screens/after/product-1280.jpg) | ![](screens/before/product-390.jpg) | ![](screens/after/product-390.jpg) |
| Поиск «подстовка для книг» (опечатка) | ![](screens/before/search-1280.jpg) | ![](screens/after/search-1280.jpg) | ![](screens/before/search-390.jpg) | ![](screens/after/search-390.jpg) |
| Корзина (пустая, гость) | ![](screens/before/cart-1280.jpg) | ![](screens/after/cart-1280.jpg) | ![](screens/before/cart-390.jpg) | ![](screens/after/cart-390.jpg) |
| Регистрация | ![](screens/before/register-1280.jpg) | ![](screens/after/register-1280.jpg) | ![](screens/before/register-390.jpg) | ![](screens/after/register-390.jpg) |
| Доставка | ![](screens/before/delivery-1280.jpg) | ![](screens/after/delivery-1280.jpg) | ![](screens/before/delivery-390.jpg) | ![](screens/after/delivery-390.jpg) |

## Как проверить локально

Сайт живёт в подпапке `/test-zadanie/kanctovar/`, поэтому корень сервера — папка **над** репозиторием.
Если папка репозитория называется иначе, создайте рядом ссылку `test-zadanie` на неё.

```bash
python3 -m http.server 8000 --directory ..
```

Откройте http://localhost:8000/test-zadanie/kanctovar/.

Проверки:

```bash
python3 tools/build_site.py --check      # страницы собраны из текущих данных (0 изменений)
python3 tools/check_links.py             # нет битых ссылок и ссылок на корень домена
node tools/search.test.js                # запросы поиска из ТЗ
```

Без Node автотест поиска запускается через JavaScriptCore, встроенный в macOS:

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tools/search.test.js
```
