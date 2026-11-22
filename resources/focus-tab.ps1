# Focuses the Windows Terminal tab whose title contains one of the '|'-separated -Match strings (tried in order).
# Exit codes: 0 = tab focused, 2 = no tab matched but a Windows Terminal window was brought forward, 1 = nothing found.
param([string]$Match = '')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -Namespace Huddle -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
'@

$AE = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]

function Bring-Forward($window) {
  $h = [IntPtr]$window.Current.NativeWindowHandle
  if ([Huddle.Win]::IsIconic($h)) { [Huddle.Win]::ShowWindow($h, 9) | Out-Null }
  # A synthetic Alt tap lets this process take the foreground (Windows foreground-lock rule).
  [Huddle.Win]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  [Huddle.Win]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
  [Huddle.Win]::SetForegroundWindow($h) | Out-Null
}

$byClass = New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, 'CASCADIA_HOSTING_WINDOW_CLASS')
$windows = @($AE::RootElement.FindAll($Scope::Children, $byClass))
if ($windows.Count -eq 0) { Write-Output 'none'; exit 1 }

$isTab = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::TabItem)

foreach ($m in ($Match -split '\|')) {
  if ([string]::IsNullOrWhiteSpace($m)) { continue }
  foreach ($w in $windows) {
    foreach ($tab in @($w.FindAll($Scope::Descendants, $isTab))) {
      $name = $tab.Current.Name
      if ($name -and $name.IndexOf($m, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        $sel = $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $sel.Select()
        Bring-Forward $w
        Write-Output "tab:$name"
        exit 0
      }
    }
  }
}

$names = foreach ($w in $windows) { foreach ($tab in @($w.FindAll($Scope::Descendants, $isTab))) { $tab.Current.Name } }
Bring-Forward $windows[0]
Write-Output ("window; tabs=" + (($names | ForEach-Object { "[$_]" }) -join ' '))
exit 2
