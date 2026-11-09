# Estado Crítico

Videojuego 2D de sigilo en el que cada enemigo es un autómata: los centinelas y el dron son **máquinas de Mealy** y la cámara de seguridad es una **máquina de Moore**. Proyecto de aula de Teoría de la Computación, Universidad de Pamplona (2026-II).

![Modo Autómata](docs/capturas/modo-automata.png)


### Controles

| Acción | Computador | Celular |
| --- | --- | --- |
| Moverse | WASD o flechas | Palanca |
| Caminar en silencio | Shift | Sigilo |
| Copiar datos | E o Espacio (mantener) | Copiar |
| Pulso EMP | Q | EMP |
| Distractor | F o clic | Lanzar |
| Modo Autómata | Tab | Autómata |
| Pausa | Esc | Pausa |

## Los enemigos

| Enemigo | Tipo | Estados |
| --- | --- | --- |
| Centinela | Mealy | Patrullar, Investigar, Perseguir, Atacar, Buscar, Regresar, Aturdido |
| Cámara | Moore | Barrido, Detectando, Alarma |
| Dron | Mealy | Orbitar, Rastrear, Marcar, Recargar |

Alfabeto del Centinela: `v` visto, `c` cerca, `l` lejos, `p` perdido, `r` ruido, `g` alerta, `d` destino, `t` tiempo, `s` pulso EMP.

![Laboratorio](docs/capturas/laboratorio.png)


## Autor

Danny Lizka Vargas Rico · Ingeniería de Sistemas · Universidad de Pamplona

Licencia MIT.
