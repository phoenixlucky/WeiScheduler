!macro SetLocalizedInstallerStrings
  StrCpy $R7 "WeiScheduler"
  StrCpy $R8 "WeiScheduler"
  StrCpy $R9 "WeiScheduler is a web-based local task scheduler built on Node.js, designed to execute Python scripts based on Cron expressions. It supports multiple Python and Conda environment configurations, making it suitable for data processing, automation workflows, and scheduled scripting tasks."

  StrCmp $LANGUAGE 2052 0 +4
    StrCpy $R7 "尉定时任务调度器"
    StrCpy $R8 "尉定时任务调度器"
    StrCpy $R9 "WeiScheduler 是一个基于 Node.js 的本地网页调度工具，用于按 Cron 表达式定时执行 Python 脚本。支持多种 Python/Conda 环境配置，适用于数据处理、自动化任务和脚本调度场景。"

  StrCmp $LANGUAGE 1028 0 +4
    StrCpy $R7 "尉定时任务调度器"
    StrCpy $R8 "尉定时任务调度器"
    StrCpy $R9 "WeiScheduler 是一個基於 Node.js 的本地網頁調度工具，用於按 Cron 表達式定時執行 Python 腳本。支持多種 Python/Conda 環境配置，適用於數據處理、自動化任務和腳本調度場景。"
!macroend

!macro customInstall
  !insertmacro SetLocalizedInstallerStrings
  SetShellVarContext all
  SetOutPath "$INSTDIR"
  File "/oname=icon.ico" "${BUILD_RESOURCES_DIR}\icon.ico"

  Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  Delete "$DESKTOP\WeiScheduler.lnk"
  Delete "$DESKTOP\尉定时任务调度器.lnk"
  CreateShortCut "$DESKTOP\$R7.lnk" "$appExe" "" "$INSTDIR\icon.ico" 0 "" "" "$R9"
  ClearErrors
  WinShell::SetLnkAUMI "$DESKTOP\$R7.lnk" "${APP_ID}"

  Delete "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
  Delete "$SMPROGRAMS\WeiScheduler.lnk"
  Delete "$SMPROGRAMS\尉定时任务调度器.lnk"
  CreateShortCut "$SMPROGRAMS\$R7.lnk" "$appExe" "" "$INSTDIR\icon.ico" 0 "" "" "$R9"
  ClearErrors
  WinShell::SetLnkAUMI "$SMPROGRAMS\$R7.lnk" "${APP_ID}"
  WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" ShortcutName "$R7"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" DisplayName "$R8 ${VERSION}"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" Comments "$R9"
!macroend

!macro customUnInstall
  SetShellVarContext all
  Delete "$DESKTOP\WeiScheduler.lnk"
  Delete "$DESKTOP\尉定时任务调度器.lnk"
  Delete "$SMPROGRAMS\WeiScheduler.lnk"
  Delete "$SMPROGRAMS\尉定时任务调度器.lnk"
!macroend
