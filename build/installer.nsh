!macro customInstall
  IfFileExists "$EXEDIR\Qwen2.5-14B-Instruct-Q4_K_M.gguf" model_found model_missing

  model_missing:
    MessageBox MB_ICONEXCLAMATION|MB_OK "The local AI model was not found beside the installer. The application will install, but AI analysis will remain unavailable. Place Qwen2.5-14B-Instruct-Q4_K_M.gguf beside this installer and run the installer again to install the model."
    Goto model_done

  model_found:
    CreateDirectory "$INSTDIR\resources\ai"
    CopyFiles /SILENT "$EXEDIR\Qwen2.5-14B-Instruct-Q4_K_M.gguf" "$INSTDIR\resources\ai"

  model_done:
!macroend
