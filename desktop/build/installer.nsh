; Custom NSIS script - Tela de boas-vindas personalizada
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao Instalador do CloudVault"
  !define MUI_WELCOMEPAGE_TEXT "Este assistente irá instalar o CloudVault no seu computador.$\r$\n$\r$\nCloudVault é seu armazenamento em nuvem - envie, organize e acesse seus arquivos de qualquer lugar.$\r$\n$\r$\nÉ recomendável fechar outras aplicações antes de continuar. Clique em Próximo para continuar."
  !insertMacro MUI_PAGE_WELCOME
!macroend
