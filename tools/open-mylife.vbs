' MY LIFE を開く（サーバーが止まっていれば裏で起動してから開く）
' 引数 /serve を付けると、サーバーの起動だけを行う（PC起動時用）
Option Explicit
Dim sh, fso, root, node, url, i, serveOnly
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
node = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
url = "http://localhost:8765/#/today"
serveOnly = (WScript.Arguments.Count > 0)

Function IsUp()
  On Error Resume Next
  Dim x
  Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  x.setTimeouts 1000, 1000, 1000, 1000
  x.Open "GET", "http://localhost:8765/index.html", False
  x.Send
  IsUp = (Err.Number = 0 And x.Status = 200)
End Function

If Not IsUp() Then
  sh.CurrentDirectory = root
  sh.Environment("PROCESS")("PORT") = "8765"
  sh.Run """" & node & """ tools\serve.js", 0, False
  For i = 1 To 20
    WScript.Sleep 300
    If IsUp() Then Exit For
  Next
End If

If Not serveOnly Then sh.Run url
