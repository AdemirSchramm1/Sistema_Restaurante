# 6. Editar o cardápio

O gerente e o chef montam o que o cliente vê: seções, ordem, foto, descrição e preço. Spec
[013](../../../specs/013-editar-cardapio/spec.md).

## Quem pode

| O que | Quem |
|---|---|
| Ver a tela **Cardápio** (menu, área Operação) e mudar seções, ordem, foto e descrição | Gerente e chef (`menu.write`) |
| Mudar o preço e criar produto novo pela tela Cardápio | Quem também tem `recipe.write` (gerente e chef) |
| Marcar "Esgotado hoje" | Quem tem `product.sold_out` |
| Pôr, trocar e tirar o logo e a foto de capa (016) | Gerente (`menu.appearance`); o chef vê o quadro sem os botões |

Os outros papéis não veem a tela; se abrirem o endereço, caem em "Sem acesso". Cada tentativa sem
permissão fica gravada na auditoria.

## Tela Cardápio

Mostra as seções na ordem em que o cliente vê e, em cada uma, os produtos vendidos com foto
pequena, nome, preço e os selos "Sem preço", "Inativo", "Esgotado hoje" e "Sem foto". Produto sem
preço ou inativo aparece para a equipe, com o selo, mas não para o cliente.

### Seções

- **Criar**: nome de até 40 letras. Dois nomes iguais (sem contar maiúsculas e acentos) não entram:
  "Já existe a seção Lanches".
- **Renomear**, **Subir** e **Descer**: os botões funcionam com o dedo e com o teclado. A primeira
  seção não sobe e a última não desce.
- **Apagar**: pede confirmação e diz para onde vão os produtos ("Os 4 produtos de Lanches vão para
  Outros"). Nenhum produto é apagado.
- **Outros** é onde fica o produto sem seção. Não dá para renomear nem apagar, e só aparece se tiver
  produto. Para o cliente, "Outros" vem sempre no fim.
- Se nenhum produto tiver seção, o cardápio do cliente não mostra títulos nem a barra de seções.

### Ordem dos produtos

Cada produto sobe e desce dentro da sua seção. Mudar a ordem não muda preço, não cria versão do
produto e não mexe em pedido enviado. Produto novo entra no fim de "Outros"; produto que muda de
seção entra no fim da seção nova.

## Tela do produto

Tocar no produto abre foto, preço, "Esgotado hoje", descrição e seção num lugar só. Cada parte
salva sozinha, e o "Salvo" só aparece quando o servidor confirma.

### Foto

- **Escolher foto** abre os arquivos do aparelho; **Tirar foto com a câmera** abre a câmera no
  celular e no tablet.
- A foto escolhida aparece primeiro em **prévia**, já no recorte 4:3 do cartão do cliente. Só vai
  para o cardápio depois de **Salvar foto**; **Cancelar** descarta.
- Aceita JPG, PNG ou WebP de até 10 MB, com pelo menos 600 px no lado menor. Fora disso:
  "Use uma foto JPG, PNG ou WebP.", "A foto pode ter até 10 MB." ou "Essa foto é pequena e vai ficar
  borrada no cardápio. Use uma foto de pelo menos 600 px."
- A foto tirada com o celular de lado aparece em pé (a orientação da câmera é respeitada).
- O aparelho reduz a foto antes de enviar, para gastar pouco do plano de dados; a barra mostra o
  progresso. Se o envio falhar, a foto antiga continua valendo e dá para tentar de novo.
- **Trocar foto** substitui; **Tirar foto do cardápio** pede confirmação.

### Descrição

Texto simples de até 300 caracteres, com quebras de linha. O campo mostra quantos caracteres
faltam. Espaços no começo e no fim são tirados; marcação (HTML) aparece como texto. Descrição vazia
é permitida.

### Preço e "Esgotado hoje"

São os mesmos do cadastro do produto ([painel de custo](../estoque/08-custo-dos-produtos.md)) e da
cozinha ([Cozinha e garçom](03-cozinha-e-garcom.md)), só que no mesmo lugar. Preço em branco deixa o
produto sem preço, e ele some do cardápio do cliente. Se um cliente estava com o produto no
carrinho, o envio avisa do preço novo e pede outra confirmação.

Se duas pessoas mudam o mesmo produto ao mesmo tempo, a segunda vê "Outra pessoa mudou este
produto. Recarregue a tela."

## Novo produto

**Novo produto** cria o produto vendido direto pela tela Cardápio: nome, o que vai nele (as mesmas
linhas do cadastro de produtos), preço, seção, descrição e foto. O produto entra no fim da seção
escolhida. Tudo é gravado junto; se algum campo for recusado, nada é criado. A foto vai logo
depois: se ela não chegar, o produto já está salvo e a tela dele abre com "Produto salvo, mas a foto
não foi enviada. Tente de novo."

O nome e os ingredientes continuam sendo mudados no cadastro do produto ("Editar nome e
ingredientes").

## Aparência

Quadro **Aparência** no topo da tela Cardápio (spec 016, US1): o **logo** (quadrado, pelo menos
200 px no lado menor) e a **foto de capa** (cortada em 3:1, pelo menos 1200 px de largura). Cada um
tem escolher, ver antes de salvar, salvar, cancelar, **Trocar** e **Tirar** (com confirmação). A
foto é reduzida no aparelho antes de subir e o servidor grava os tamanhos prontos (logo 96, 192 e
384 px; capa 600, 1200 e 1920 px). Imagem pequena: "O logo precisa ter pelo menos 200 px no lado
menor." ou "A foto de capa precisa ter pelo menos 1200 px de largura.". Trocar ou tirar fica no
histórico do restaurante, com quem e quando. O cliente vê o logo e a capa no topo do cardápio e nas
boas-vindas do tablet.

## Ver como o cliente

Mostra o cardápio como ele está agora, como **Celular pelo QR code** ou como **Tablet da mesa**
(016, com as boas-vindas e sem prazo), em três tamanhos: **Celular** (linhas), **Tablet em pé** (3
cartões por linha) e **Tablet deitado** (3 cartões e o carrinho ao lado). O Tablet da mesa abre
deitado. Uma faixa avisa
"Pré-visualização: pedidos não são enviados". Dá para montar um pedido para ver como fica, mas não
para enviar. Nenhum acesso de mesa é aberto e nada é gravado. No celular, a pré-visualização ocupa
a largura da tela, sem os botões de tamanho.

## Histórico

Toda mudança fica no histórico do produto ou da seção, com quem fez e quando: foto posta, trocada
ou tirada, descrição e seção (antes e depois), posição, seção criada, renomeada, movida e apagada.
