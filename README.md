# ATRFB — controle da trilha

App para acompanhar a Trilha de Analista Tributário da Estratégia, no lugar da
Planilha de Controle. Lê o `.xlsx` da Estratégia, guarda o progresso num
repositório **privado** seu no GitHub e exporta de volta para o mesmo `.xlsx`.

## Telas

- **Agora**: a próxima tarefa, o cronômetro da sessão e o registro de tempo, questões e acertos.
- **Semana**: os 7 dias com o que foi feito e o planejamento. Arraste uma tarefa para outro dia (ou para ← → para outra semana); no celular, toque nela e depois no dia. O que não for arrastado segue a ordem da trilha pela meta diária.
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
- Use um token *fine-grained* com acesso apenas ao repositório de dados e a
  permissão **Contents: Read and write**.

## Senha

Não há login nem servidor. Para alterar dados ou baixar arquivos, o app pede uma senha:

- A senha não é guardada. Dela saem, por PBKDF2-SHA256 (600 mil iterações),
  um verificador e uma chave AES-GCM.
- O verificador fica no navegador e em `acesso.json` no repositório de dados,
  para valer a mesma senha em todos os aparelhos.
- O token do GitHub fica no navegador **cifrado** com essa chave. Sem a senha,
  o app não consegue gravar no GitHub nem ler o repositório.
- "Manter desbloqueado por 8 horas" guarda a chave como `CryptoKey` não
  exportável no IndexedDB, que expira sozinha. "Bloquear" apaga.
- Esqueceu a senha: conecte de novo com o token marcando "Esqueci a senha".
  Quem tem o token é o dono do repositório. Sem GitHub, não há recuperação.

Limite honesto: quem tiver o seu aparelho desbloqueado consegue ver os dados
(ver não pede senha), e a cópia local pode ser lida pelo navegador. A senha
protege contra alterações e downloads, e o token contra uso fora do aparelho.

## Publicar

O workflow `.github/workflows/pages.yml` publica no GitHub Pages a cada push na
`main` (em *Settings › Pages*, escolha *GitHub Actions* como origem). O código
pode ficar num repositório separado do repositório de dados.

## Testes

`npm test` lê e exporta a planilha real se ela estiver em `fixtures/planilha.xlsx`
(a pasta não vai para o git).
