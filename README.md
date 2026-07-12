# Plan FIT · 31 días

Calendario web para seguir tu plan de entrenamiento de 31 días: entra en cada día, ve los ejercicios con sus repeticiones/tiempos, usa el temporizador integrado y marca lo que vayas completando. Tu progreso se guarda en el navegador (no necesita backend ni cuenta).

## Ver en local

No hace falta instalar nada. Abre `index.html` con doble clic, o sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Publicarlo gratis en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `plan-fit-31`).
2. Sube estos archivos tal cual (`index.html`, la carpeta `assets/`, este `README.md`):
   ```bash
   git init
   git add .
   git commit -m "Plan FIT 31 días"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/plan-fit-31.git
   git push -u origin main
   ```
3. En el repo de GitHub: **Settings → Pages → Source**, elige la rama `main` y la carpeta `/ (root)`.
4. Guarda. En un par de minutos tu app estará en `https://TU_USUARIO.github.io/plan-fit-31/`.

## Estructura

```
index.html          Página principal (calendario + vista de día)
assets/style.css     Estilos
assets/app.js        Lógica: calendario, temporizadores, progreso
assets/data.js       Los 31 días de entrenamiento (edítalo aquí para cambiar ejercicios)
```

## Cómo editar tu plan

Todo el contenido de los ejercicios vive en `assets/data.js`, en el array `WORKOUTS`. Cada día es un objeto así:

```js
{
  day: 1, week: 1, type: "fuerza",
  title: "Fuerza tren superior + piernas",
  format: "3 rondas", rounds: 3,
  restBetweenExercises: 20, restBetweenRounds: 60,
  exercises: [
    { name: "Flexiones", reps: 10, scale: "De rodillas si hace falta" },
    { name: "Plancha", seconds: 30 },
  ],
}
```

- Usa `reps` para ejercicios por repeticiones o `seconds` para ejercicios por tiempo (estos últimos muestran un temporizador con sonido al acabar).
- `scale` es una nota opcional de "versión más fácil".
- `type` controla el color/etiqueta: `fuerza`, `core`, `hiit`, `cardio`, `descanso`, `test`, `reto` (puedes ajustar colores en `TYPE_META`, al final de `data.js`).

## Notas

- El progreso se guarda con `localStorage`, así que es por navegador/dispositivo. Si lo abres en el móvil y en el ordenador, cada uno lleva su propio progreso.
- El botón "Reiniciar progreso" (abajo de la página) borra todas las casillas marcadas.
