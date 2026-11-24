!macro customInstall
  CreateDirectory "$INSTDIR\resources\study-materials"

  ${If} ${FileExists} "$EXEDIR\study-materials\9分达人.zip"
    DetailPrint "正在安装九分达人资料，请耐心等待..."
    CopyFiles /SILENT "$EXEDIR\study-materials\9分达人.zip" "$INSTDIR\resources\study-materials\9分达人.zip"
  ${Else}
    MessageBox MB_ICONEXCLAMATION|MB_OK "未找到 study-materials\9分达人.zip。软件可以安装，但九分达人资料暂时不可用。请保持安装程序和 study-materials 文件夹在同一目录后重新安装。"
  ${EndIf}

  ${If} ${FileExists} "$EXEDIR\study-materials\[PDF] ZYZ 八月合集.zip"
    DetailPrint "正在安装阅读资料..."
    CopyFiles /SILENT "$EXEDIR\study-materials\[PDF] ZYZ 八月合集.zip" "$INSTDIR\resources\study-materials\[PDF] ZYZ 八月合集.zip"
  ${Else}
    MessageBox MB_ICONEXCLAMATION|MB_OK "未找到 study-materials\[PDF] ZYZ 八月合集.zip。软件可以安装，但对应的本地阅读 PDF 暂时不可用。"
  ${EndIf}
!macroend
