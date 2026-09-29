import { Auth } from './auth.js';
import { Carousel } from './carousel.js';
import { Suggest } from './suggest.js';

const API_BASE = 'http://localhost:8089';

const auth = new Auth(API_BASE);
const carousel = new Carousel(API_BASE, auth);
const suggest = new Suggest(API_BASE, auth);

auth.init();
carousel.init();
suggest.init();

console.log('Movies API Landing - Inicializado');
console.log('Auth:', auth);
console.log('Carousel:', carousel);
console.log('Suggest:', suggest);