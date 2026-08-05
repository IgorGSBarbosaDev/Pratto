# Critérios de aceite da fundação

- O projeto pode ser instalado a partir da raiz com pnpm.
- Os serviços locais sobem com Docker Compose e têm healthchecks.
- A web exibe uma página inicial mobile-first.
- A API responde em `/health` e documenta-se em `/docs`.
- A configuração inválida impede a inicialização.
- A API gera logs estruturados e request IDs.
- Erros HTTP têm códigos estáveis e não expõem detalhes internos.
- Os adapters locais de storage e e-mail possuem interfaces substituíveis.
- Lint, typecheck, testes e build têm comandos reproduzíveis.
- O CI executa essas verificações em uma instalação limpa.
