import { startUi } from './ui.js';

startUi(document.getElementById('app'));

// Lets the app show reminders from the home screen. Pages are not cached, so updates arrive on the next open.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
