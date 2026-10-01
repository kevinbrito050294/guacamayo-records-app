/** @type {import('tailwindcss').Config} */
export default {
  // 1. IMPORTANTE: Esto permite que el botón active el modo oscuro
  darkMode: 'class', 
  
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  
  theme: {
    extend: {
      // 2. CONFIGURAMOS LA FUENTE: Para que "font-guacamayo" funcione
      fontFamily: {
        guacamayo: ['"Bebas Neue"', 'sans-serif'],
      },
      // 3. OPCIONAL: Colores personalizados si quieres el ámbar exacto
      colors: {
        guacamayo: {
          yellow: '#F2C94C', // El amarillo de tu logo
        }
      }
    },
  },
  plugins: [],
};