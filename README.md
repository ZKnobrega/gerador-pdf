# GuiaMaker Pro — Gerador de Manuais e Tutoriais em PDF

> **Projeto pessoal.** A ideia surgiu da necessidade de criar manuais de sistemas no meu trabalho, mas o projeto é pessoal e não tem vínculo com nenhuma instituição.

Aplicativo desktop para Windows que transforma capturas de tela em manuais práticos e tutoriais passo a passo, com anotações visuais, exportação em PDF e identidade visual personalizável.

Inspirado nas melhores ferramentas do mercado (**Folge**, **Scribe**, **Tango** e **Snagit**), funciona de forma **local e offline**. Os recursos de IA são opcionais e só enviam dados ao Gemini quando você os usa.

---

## 🚀 Como Iniciar o Aplicativo

Basta clicar duas vezes em um dos arquivos executáveis na pasta do projeto:

1. **`iniciar.bat`**: Inicia a aplicação como **aplicativo nativo desktop para Windows** (Electron).
2. **`iniciar-navegador.bat`**: Inicia a aplicação no seu navegador padrão (Chrome, Edge, etc.).

---

## 🏠 Tela Inicial & Gestão de Tutoriais Recentes
- **Criar Novo Tutorial**: Formulário rápido para definir o título, nome do sistema e instituição e começar a produzir.
- **Editar Tutorial Existente**: Carregador de arquivos `.json` salvos no seu computador para continuar a edição.
- **Modelo de Exemplo**: Atalho com 1 clique para carregar o modelo de exemplo completo de 6 passos de exemplo.
- **Tutoriais Recentes**: Grade com todos os tutoriais trabalhados recentemente, exibindo:
  - Sistema, Título, Órgão, quantidade de passos e data/hora da última alteração.
  - Ações rápidas para **Editar**, **Baixar JSON** ou **Remover dos recentes**.
  - Campo de busca instantânea para encontrar manuais por nome ou sistema.
- **Botão "Início" no Editor**: Permite alternar facilmente entre o dashboard inicial e a área de trabalho a qualquer momento.

---

## ✨ Principais Funcionalidades

### 1. Suporte a Múltiplas Imagens por Passo
- **Quantas imagens desejar**: Adicione 1, 2, 3 ou mais capturas de tela em um mesmo passo (ideal para demonstrar sequências de cliques ou telas correlatas).
- **Controle Individual por Imagem**:
  - Cada imagem possui sua própria **legenda personalizada** (ex: *Figura 1.1*, *Figura 1.2*).
  - Cada imagem possui sua própria **largura no PDF** (100%, 85%, 70% ou 50%).
  - **Reorganização**: Mova imagens para cima ou para baixo dentro do passo com 1 clique.
  - **Edição Individual**: Botão de abrir o estúdio de anotações (cortar, setas, blur, destaques) específico para cada imagem.
- **Carregamento em Lote ou Clipboard**:
  - Selecione múltiplos arquivos de uma vez no seletor de imagens.
  - Ou pressione `Ctrl + V` sucessivas vezes para colar vários prints seguidos da área de transferência!

### 2. Exportação em PDF Multi-Página Direta (Navegador & Desktop)
- **📥 Botão "Baixar PDF (.pdf)"**: Compila automaticamente todas as folhas A4 em um arquivo PDF real e faz o download direto para a sua pasta de Downloads.
- **Feedback Visual de Progresso**: Modal com barra de carregamento e indicação de páginas renderizadas (*Processando página 1 de 5...*).
- **Impressão Corrigida para Múltiplas Páginas**: Removidos os cortes de altura do navegador; todas as folhas A4 com cabeçalhos e quebras de página são impressas sem cortes.

### 3. Editor de Imagens & Desfoque com Controle em Tempo Real
- **Controle Dinâmico de Blur**: O controle deslizante e os botões pré-definidos (*Suave*, *Médio*, *Extremo*) atualizam o desfoque sobre a imagem **em tempo real** conforme você move o slider.
- **Algoritmo Fast Box Blur em Memória**: Opera diretamente nos pixels da imagem (3 passes de convolução com acumulador deslizante), substituindo os pixels nítidos por um degradê opaco sem vazamento de texto.
- **Película Fosca Protetora (0% a 80%)**: Camada leitosa anti-transparência para garantir sigilo de CPFs, senhas e nomes.
- **Mosaico (Pixelate) com Controle de Tamanho**: Ajuste de 6px a 36px com atualização imediata.
- **Destaques com Retângulos/Caixas**: Adicione retângulos coloridos (vermelho, azul, verde, etc.) para evidenciar botões e campos no sistema.
- **Setas Apontadoras**: Desenhe setas direcionais nítidas apontando para ícones de ação.
- **Carimbos Numéricos de Passo (1, 2, 3...)**: Carimbe marcadores redondos ordenados direto na imagem.
- **Recorte Interativo (Crop)**: Recorte a área exata do screenshot com alças arrastáveis.
- **Zoom & Pan**: Aumente ou diminua o zoom para desenhar com precisão em telas de alta resolução.
- **Desfazer / Refazer (Undo/Redo)**: Suporte a atalhos de teclado (`Ctrl + Z` e `Ctrl + Y`).

### 3.1 Foco Automático no Clique (Recorte Não Destrutivo)
- **Automático**: toda captura que possui um **clique**, uma **caixa de ação** ou um **carimbo numérico**
  marcado ganha sozinha uma área de foco — calculada pela caixa que envolve os cliques, com uma margem de
  respiro para o leitor continuar reconhecendo a tela. Vale também para as gravações feitas pelo Gravador de Passos.
- **A imagem completa nunca é perdida**: o recorte é apenas uma marcação (coordenadas de 0 a 1) aplicada na
  hora de desenhar o PDF. Um clique em *Imagem Completa* devolve a captura inteira, sem perda de qualidade.
- **Três formas de apresentar no PDF** (escolhidas por imagem):
  - **Recorte**: o PDF mostra apenas a área do clique, ampliada na largura da figura. Opcionalmente exibe
    a tela completa, reduzida, logo abaixo (*Mostrar tela completa abaixo*).
  - **Holofote**: a tela inteira aparece no PDF, com o entorno escurecido e a área do clique realçada.
  - **Lupa**: a tela inteira aparece no PDF e, abaixo, um detalhe ampliado da área da ação.
- **Ajuste fino**: a ferramenta **Foco** do editor de imagens permite arrastar a área, redimensionar pelas alças
  (com guias de terços) ou recalcular tudo com o botão *Focar nos Cliques*. Ao ajustar à mão, a região passa de
  **Automática** para **Manual** e deixa de seguir os cliques.
- **Onde controlar**: direto no cartão da imagem, no editor de passos (ligar/desligar, trocar de modo) ou no
  estúdio de anotações, pela ferramenta *Foco*.

### 3.2 Biblioteca Pública de PDFs Publicados
- **Botão "Publicar PDF"**: gera o PDF final do manual e o envia para o servidor, onde ele passa a integrar o
  histórico público exibido na tela inicial.
- **Histórico de PDFs Publicados**: seção na tela inicial com todos os manuais finalizados, mostrando sistema,
  órgão, número de páginas, tamanho e data da publicação.
- **Aberto para toda a rede**: qualquer computador que acessa o sistema pode **abrir** ou **baixar** o PDF, sem
  precisar abrir o tutorial no editor. O projeto editável continua separado e intacto.
- **Armazenamento**: os arquivos ficam em `data/pdfs` (configurável por `PDF_DIR`), com volume próprio no
  `docker-compose.yml` para sobreviver a reiniciações do container. Limite de 60 MB por PDF.
- **Endpoints**: `GET /api/pdfs`, `POST /api/pdfs`, `GET /api/pdfs/:id/file` (use `?download=1` para forçar o
  download) e `DELETE /api/pdfs/:id`.

### 4. Estrutura dos Passos do Manual
- **Título & Objetivo**: Cabeçalho de cada etapa com objetivo em itálico institucional.
- **Instruções com Formatação Rápida**: Digite instruções com marcadores automáticos e use `**palavra**` para destacar termos em negrito.
- **Caixas de Alerta / Destaque**:
  - 💡 **Dica / Informação** (fundo verde claro, ícone de lâmpada)
  - ⚠️ **Atenção Crítica / Impacto** (fundo vermelho claro, ícone de alerta)
  - ℹ️ **Nota Informativa** (fundo azul claro)
  - ✅ **Confirmação / Sucesso**
- **Controle de Paginação**: Opção de quebra de página por passo para diagramar exatamente quais passos ficam em cada folha A4.
- **Reorganização dos Passos**: Mova passos para cima ou para baixo e exclua ou duplique com 1 clique.

### 5. Personalização Total do Design & Identidade Visual
- **Paletas Pré-definidas**:
  - *Azul Padrão*
  - *Verde Institucional*
  - *Azul Corporativo / Tech*
  - *Vinho / Bordô Tribunal*
  - *Grafite Elegante / Slate*
- **Seletores de Cor Hexadecimal**: Escolha qualquer cor para títulos, badges, caixas e bordas.
- **Cabeçalho Oficial**:
  - Nome do Órgão / Empresa
  - Título do Manual e Subtítulo
  - Nome do Sistema e Etiqueta do Guia (ex: `SISTEMA EXEMPLO • Guia do Usuário`)
  - Caixa de Finalidade do Manual com borda lateral de destaque
- **Rodapé de Suporte de TI**:
  - Cartão de Atendimento em destaque
  - Canais de contato: Telefone / Ramal, Chat Interno e E-mail Institucional
  - Nota de versão e departamento de informática

---

## 🛠️ Tecnologias Utilizadas

- **Runtime & Desktop**: Electron 44, Node.js
- **Interface & UI**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Editor Gráfico**: HTML5 Canvas API (Fast Box Blur in-place, Mosaico e Geometria Vetorial)
- **Engine de PDF**: jsPDF + html2canvas (multi-page A4) e CSS Paged Media
- **Build Tool**: Vite
