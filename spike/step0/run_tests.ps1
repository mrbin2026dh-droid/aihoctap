$env:PATH = "C:\Program Files\Android\Android Studio\jbr\bin;" + $env:PATH
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
Set-Location "$PSScriptRoot\emulator"
npm test
