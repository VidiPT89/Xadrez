# ♚ Xadrez — Joga, Aprende, Domina o Tabuleiro

> Uma app de xadrez completa no browser — joga 1 vs 1 no mesmo ecrã, desafia um bot com 4 níveis de dificuldade, e aprende as regras e estratégias com um tutorial passo-a-passo.

**♟️ [Live Demo](https://vidipt89.github.io/Xadrez/)**

"Xadrez" é um jogo de tabuleiro completo construído com vanilla HTML, CSS e JavaScript — sem frameworks, sem build step, sem bibliotecas de xadrez externas. O motor de regras, a inteligência artificial e toda a interface são feitos de raiz. Joga uma partida local a dois, desafia o bot num dos quatro níveis de dificuldade, ou aprende a jogar do zero com lições interativas sobre movimentação, regras especiais, aberturas, táticas e finais.

## 📦 What's Inside

- ♟️ Motor de regras completo: todos os movimentos das peças, roque (ambos os lados), en passant, promoção, xeque, xeque-mate, afogamento, regra dos 50 lances, material insuficiente e repetição tripla
- 📜 Histórico de lances em notação algébrica simplificada, com desambiguação automática
- 🧑‍🤝‍🧑 Modo 1 vs 1 — dois jogadores alternam no mesmo dispositivo
- 🤖 Modo Contra o Bot com 4 níveis de dificuldade (Iniciante, Fácil, Médio, Difícil), motor minimax com poda alfa-beta, tabelas de posição por peça e pesquisa por tempo limitado no nível Difícil
- 🧠 O bot corre num Web Worker dedicado — nunca bloqueia a interface, mesmo a pensar em profundidade
- 🎓 Modo Tutorial com 5 lições interativas: movimentação das peças, regras especiais, princípios de abertura, táticas básicas (garfos, cravos, espetos) e finais básicos
- ❓ Modo Ajuda com referência rápida de regras, modos de jogo e controlos
- 🇵🇹 🇬🇧 Alternância de idioma entre Português Europeu e Inglês, guardada entre visitas
- 🔊 Efeitos sonoros sintetizados via Web Audio API para lances, capturas, xeque e fim de jogo
- 🎬 Splash de abertura animado com apresentação da app, que desaparece automaticamente
- 🖼️ Tabuleiro em SVG de alta definição — peças desenhadas em vetor com gradiente e sombra, tabuleiro com textura de madeira, sempre nítido em qualquer tamanho de ecrã
- 🎞️ Movimento das peças animado (incluindo roque) em vez de instantâneo
- ↩️ ↪️ Voltar Atrás / Avançar no modo Contra o Bot
- 🌌 Fundo ambiente animado, independente do tabuleiro

## 🛠️ Tech Stack

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

## 🏗️ Project Structure

```
Xadrez/
├── index.html         # Estrutura da página, menu, tabuleiro, tutorial, ajuda, modais
├── style.css           # Tema, layout do tabuleiro, responsividade, animações
├── script.js            # Arranque, i18n, roteamento de ecrãs, UI, lições, ajuda
├── chess-engine.js      # Motor de regras puro (geração e validação de lances, notação)
├── chess-ai.js            # Bot de IA (minimax + poda alfa-beta), corre num Web Worker
├── LICENSE
└── README.md
```

## ⚙️ Game Mechanics

```
Cada lance:
  1. O jogador ativo toca numa peça sua — os lances legais dessa peça ficam destacados
  2. Toca numa casa destacada para jogar (um anel indica captura)
  3. Se o lance for uma promoção, um seletor pede a peça de destino (Dama, Torre, Bispo ou Cavalo)
  4. O motor atualiza o estado: roque, en passant e direitos de roque são geridos automaticamente
  5. Após o lance, verifica-se xeque, xeque-mate, afogamento e as três regras de empate
  6. No modo Contra o Bot, quando é a vez das Pretas, o Web Worker calcula o melhor lance
     para o nível escolhido e devolve-o assim que terminar a pesquisa
```

## 🤖 Níveis do Bot

```
Iniciante — profundidade 1, comete erros propositadamente com frequência
Fácil     — profundidade 2, pequena margem de aleatoriedade
Médio     — profundidade 3, quase sempre joga o melhor lance encontrado
Difícil   — profundidade 4+ com quiescence search e aprofundamento iterativo,
            sempre o melhor lance dentro do tempo disponível
```

## 🚀 How to Run

```bash
# 1. Clone the repository
git clone https://github.com/VidiPT89/Xadrez.git

# 2. Open index.html in your browser
cd Xadrez
open index.html    # macOS
# or: start index.html (Windows) / xdg-open index.html (Linux)
```

O modo Contra o Bot usa um Web Worker, pelo que alguns browsers exigem que a página seja servida por HTTP em vez de aberta diretamente como ficheiro. Nesse caso, usa um servidor estático simples:

```bash
python3 -m http.server
# depois abre http://localhost:8000
```

No build step, no dependencies — apenas HTML, CSS e JS estáticos.

## 📝 Notes

- Todo o motor de xadrez e a IA foram escritos de raiz, sem bibliotecas externas
- As preferências de idioma e som são guardadas em `localStorage`, persistindo entre visitas
- `prefers-reduced-motion` é respeitado nas animações decorativas da interface

---

Developed by **David Arsénio Martins**
