# ATRFB — controle da trilha

App para acompanhar a Trilha de Analista Tributário da Estratégia, no lugar da
Planilha de Controle. Lê o `.xlsx` da Estratégia, guarda o progresso num
repositório **privado** seu no GitHub e exporta de volta para o mesmo `.xlsx`.

## Telas

- **Agora**: a próxima tarefa, o cronômetro da sessão e o registro de tempo, questões e acertos.
- **Semana**: os 7 dias com o que foi feito e a previsão pela meta diária.
- **Ciclo**: todas as trilhas, tarefa por tarefa.
- **Mapa**: o tabuleiro de aulas (teoria + revisão e acertos) e a tela de cada disciplina.
- **Analytics**: horas por semana, acerto no tempo, acerto por disciplina e constância.
- **Dados**: conexão com o GitHub, versões salvas, meta diária e exportação.

## Rodar no computador

```bash
npm install
npm run dev
```

## Onde ficam os dados

- No navegador (funciona sem internet) e, depois de conectar em **Dados**, num
  repositório privado do GitHub: `dados.json` (o progresso) e `planilha.xlsx`
  (a planilha original, usada para exportar).
- Cada salvamento é um commit, então dá para voltar a qualquer versão.
- O token do GitHub fica só no navegador. Use um token *fine-grained* com acesso
  apenas ao repositório de dados e a permissão **Contents: Read and write**.

## Publicar

O workflow `.github/workflows/pages.yml` publica no GitHub Pages a cada push na
`main` (em *Settings › Pages*, escolha *GitHub Actions* como origem). O código
pode ficar num repositório separado do repositório de dados.

## Testes

`npm test` lê e exporta a planilha real se ela estiver em `fixtures/planilha.xlsx`
(a pasta não vai para o git).
