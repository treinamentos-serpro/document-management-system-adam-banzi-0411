# Especificação - Document Management System

## 1. Objetivo

Permitir que usuários enviem, listem e baixem seus documentos, armazenados no filesystem local da aplicação.

## 2. Escopo

### Dentro do escopo

- Upload de documentos.
- Listagem dos documentos associados ao usuário da requisição.
- Download de um documento pelo identificador.
- Arquivos em armazenamento local e metadados em memória.

### Fora do escopo

- Autenticação e cadastro de usuários.
- Armazenamento em nuvem ou em serviços externos.
- Versionamento, edição e exclusão de documentos.
- Persistência durável dos metadados.
- Paginação e busca avançada.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O sistema deve aceitar um arquivo enviado como `multipart/form-data`. |
| RF-02 | O sistema deve gerar um identificador único para cada documento. |
| RF-03 | O sistema deve gravar o arquivo em `backend/storage`, usando `multer` com `diskStorage`. |
| RF-04 | O nome usado no filesystem deve ser gerado pelo sistema, nunca derivado diretamente do nome enviado. |
| RF-05 | O sistema deve registrar em memória os metadados do documento e seu proprietário. |
| RF-06 | O usuário deve listar somente documentos associados ao identificador informado na requisição. |
| RF-07 | O usuário deve baixar um documento próprio pelo identificador. |
| RF-08 | Documento inexistente ou pertencente a outro usuário deve resultar em `404`, sem revelar sua existência. |
| RF-09 | O sistema deve rejeitar requisições sem arquivo ou sem identificador de usuário válido. |
| RF-10 | O download deve ser entregue como anexo, usando o nome original com tratamento seguro. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos devem permanecer no filesystem local; não utilizar provedores externos. |
| RNF-02 | Os metadados devem permanecer em memória e serão perdidos ao reiniciar o processo. |
| RNF-03 | O limite de tamanho deve ser configurável; o padrão inicial é 10 MiB por arquivo. |
| RNF-04 | Porta, diretório de armazenamento e limite de upload devem ser configuráveis por variáveis de ambiente. |
| RNF-05 | Falhas no registro dos metadados devem remover o arquivo enviado quando possível. |
| RNF-06 | Caminhos e nomes recebidos do cliente não devem permitir escrita fora do diretório de armazenamento. |
| RNF-07 | Respostas de erro da API devem usar JSON e códigos estáveis. |
| RNF-08 | O frontend pode consumir a API pelo prefixo `/api`; o proxy atual do Vite remove esse prefixo. |

## 5. Modelo de dados

Metadados mantidos em memória:

| Campo | Tipo | Exposição | Descrição |
| --- | --- | --- | --- |
| `id` | string | API | Identificador UUID do documento. |
| `originalName` | string | API | Nome original fornecido pelo cliente, tratado como dado não confiável. |
| `size` | number | API | Tamanho em bytes. |
| `uploadedAt` | string | API | Data/hora em ISO 8601 UTC. |
| `owner` | string | API | Identificador associado à requisição. |
| `mimeType` | string | API | Tipo informado no upload. |
| `storageName` | string | Interno | Nome gerado para localizar o arquivo no diretório local. |

`storageName` e caminhos absolutos nunca são retornados pela API. A propriedade `owner` restringe listagem e download.

Nesta versão, a identidade vem do cabeçalho obrigatório `X-User-Id`. Esse valor serve somente para associação e isolamento lógico; não autentica o usuário e pode ser falsificado. O sistema não deve ser exposto como serviço multiusuário confiável sem autenticação futura.

## 6. Contratos de API

Todas as rotas abaixo exigem `X-User-Id`.

Formato padrão de erro:

```json
{
  "error": {
    "code": "FILE_REQUIRED",
    "message": "Envie um arquivo."
  }
}
```

### `POST /upload`

- Entrada: `multipart/form-data`, campo de arquivo `file`.
- Sucesso: `201 Created`, corpo com os metadados públicos do documento.
- Erros: `400` para arquivo ausente ou entrada inválida; `413` para arquivo acima do limite; `500` para falha inesperada de armazenamento.
- O cliente não escolhe o nome interno nem o caminho de armazenamento.

### `GET /documents`

- Sucesso: `200 OK`, lista JSON dos documentos do usuário; lista vazia quando não houver documentos.
- Não retorna metadados de outros usuários.
- Erro: `400` para identificador ausente ou inválido.

### `GET /documents/:id/download`

- Sucesso: `200 OK`, conteúdo binário como anexo, com `Content-Disposition` seguro.
- Erros: `404` para identificador inexistente, documento de outro usuário ou arquivo local ausente; `400` para identificador inválido.

Códigos de erro mínimos: `USER_ID_REQUIRED`, `FILE_REQUIRED`, `FILE_TOO_LARGE`, `DOCUMENT_NOT_FOUND`, `UPLOAD_FAILED` e `DOWNLOAD_FAILED`.

## 7. Decisões arquiteturais

- Backend em CommonJS com Express e dependências no fluxo `routes -> controllers -> services -> repositories`.
- Rotas definem endpoints e parsing multipart; controllers validam entrada HTTP e formatam respostas; services concentram regras de negócio; repositories tratam filesystem e metadados em memória.
- `multer` com `diskStorage` grava exclusivamente em `backend/storage` por padrão.
- O nome interno é gerado com UUID; o nome original é apenas metadado.
- Frontend em React com componentes funcionais; chamadas usam `fetch` pelo prefixo `/api`.
- Reinicialização perde metadados, embora arquivos possam permanecer no disco. Reconciliação ou limpeza de órfãos não faz parte da versão inicial.
- `PORT` define a porta (padrão `3000`), `STORAGE_DIR` pode sobrescrever o diretório e `MAX_FILE_SIZE_BYTES` define o limite (padrão 10 MiB).

## 8. Plano de execução

1. Consolidar escopo, identidade, armazenamento local e limitações de persistência nesta especificação.
2. Revisar contratos e cenários de sucesso e erro para upload, listagem, download e isolamento por usuário.
3. Confirmar limite de upload, comportamento após reinício, tratamento de nomes e limpeza em caso de falha.
4. Aprovar esta especificação antes de iniciar alterações de implementação no frontend ou em outros componentes fora do backend solicitado.