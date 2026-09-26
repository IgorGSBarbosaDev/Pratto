# ADR-006 — Storage por abstração

**Status:** aceito

O domínio dependerá de `StorageService`. MinIO implementa a porta no ambiente local; S3 ou R2
poderão implementá-la no futuro.

Uploads de produto usam chaves aleatórias sob
`product-media/{organizationId}/{menuId}/{productId}`. O bucket permanece privado: a API
retorna URLs de leitura assinadas e temporárias para o preview administrativo, sem expor a chave
ou um caminho público permanente.

Publicações armazenam a `storageKey` no snapshot imutável, nunca uma URL assinada que expiraria.
A leitura pública resolve essa chave pelo `StorageService` e emite uma URL assinada temporária para
o feed, sem expor a chave do objeto.

Objetos referenciados por qualquer publicação histórica não são apagados quando a referência
editável muda ou é removida. Alterações de mídia precisam ser serializadas com a criação do snapshot
para que a publicação não passe a apontar para um objeto já removido.

O registro transacional é a fonte de verdade: se a persistência falhar depois do upload, a API
remove o objeto recém-criado por best effort; se a remoção posterior de um objeto não referenciado
falhar, a referência é removida do banco e o objeto fica sujeito à limpeza de órfãos. Objetos ainda
referenciados por snapshots imutáveis são preservados.
