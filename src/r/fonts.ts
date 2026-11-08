// Fonts ship inside the bundle (npm), so every parallel render job draws identical text.
import '@fontsource/anton/latin-400.css';
import '@fontsource/roboto/latin-500-italic.css';
import {continueRender, delayRender} from 'remotion';

const h = delayRender('fonts');
Promise.all([document.fonts.load('40px Anton'), document.fonts.load('italic 500 40px Roboto')]).then(() => continueRender(h), () => continueRender(h));
