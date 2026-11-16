<#
.SYNOPSIS
    GuiaMaker Pro - Gravador de Passos Inteligente para Windows
    Captura cliques do mouse com icone de mouse, digitacao de texto e atalhos de teclado.
#>

param(
    [string]$ServerUrl = "http://localhost:8090",
    [string]$GeminiApiKey = "",
    [string]$SystemName = "Sistema Corporativo",
    [string]$ProcedureContext = "",
    [string]$TutorialTitle = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Win32 API interop for global mouse, keyboard & window detection
$win32Source = @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;

public class Win32 {
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, ref RECT rect);

    private static bool[] prevDown = new bool[256];

    public static bool IsKeyDown(int vKey) {
        return (GetAsyncKeyState(vKey) & 0x8000) != 0;
    }

    public static bool KeyJustPressed(int vKey) {
        bool down = IsKeyDown(vKey);
        bool wasDown = prevDown[vKey];
        prevDown[vKey] = down;
        return down && !wasDown;
    }

    public static void ResetKeys() {
        for (int i = 0; i < 256; i++) {
            prevDown[i] = IsKeyDown(i);
        }
    }

    public static string GetTypedChar(int vKey, bool isShift) {
        if (vKey == 0x20) return " ";
        if (vKey >= 0x41 && vKey <= 0x5A) {
            char c = (char)vKey;
            return isShift ? c.ToString() : char.ToLower(c).ToString();
        }
        if (vKey >= 0x30 && vKey <= 0x39) {
            if (!isShift) return ((char)vKey).ToString();
            string shiftDigits = ")!@#$%^&*(";
            return shiftDigits[vKey - 0x30].ToString();
        }
        if (vKey == 0xBC) return isShift ? "<" : ",";
        if (vKey == 0xBE) return isShift ? ">" : ".";
        if (vKey == 0xBD) return isShift ? "_" : "-";
        if (vKey == 0xBF) return isShift ? "?" : "/";
        if (vKey == 0xBA) return isShift ? ":" : ";";
        if (vKey == 0xBB) return isShift ? "+" : "=";
        if (vKey == 0xDE) return isShift ? "\"" : "'";
        return null;
    }

    public static string GetKeyName(int vKey) {
        if (vKey >= 0x41 && vKey <= 0x5A) return ((char)vKey).ToString();
        if (vKey >= 0x30 && vKey <= 0x39) return ((char)vKey).ToString();
        if (vKey >= 0x70 && vKey <= 0x7B) return "F" + (vKey - 0x70 + 1);
        if (vKey == 0x0D) return "Enter";
        if (vKey == 0x09) return "Tab";
        if (vKey == 0x1B) return "Esc";
        if (vKey == 0x2E) return "Del";
        if (vKey == 0x20) return "Espaco";
        if (vKey == 0x25) return "Seta Esquerda";
        if (vKey == 0x26) return "Seta Cima";
        if (vKey == 0x27) return "Seta Direita";
        if (vKey == 0x28) return "Seta Baixo";
        if (vKey == 0x24) return "Home";
        if (vKey == 0x23) return "End";
        if (vKey == 0x21) return "PageUp";
        if (vKey == 0x22) return "PageDown";
        return null;
    }
}
"@

Add-Type -TypeDefinition $win32Source -Language CSharp

# State variables
$global:isRecording = $false
$global:steps = [System.Collections.ArrayList]::new()
$global:lastClickTime = 0
$global:typingBuffer = ""
$global:lastTypingTime = 0
$global:appServerUrl = $ServerUrl.TrimEnd('/')
$global:geminiKey = $GeminiApiKey
$global:systemName = $SystemName
$global:procedureContext = $ProcedureContext
$global:tutorialTitle = $TutorialTitle

# Create floating control window
$form = New-Object System.Windows.Forms.Form
$form.Text = "GuiaMaker Pro - Gravador de Passos"
$form.Size = New-Object System.Drawing.Size(430, 85)
$form.StartPosition = "Manual"
$screenBounds = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$form.Location = New-Object System.Drawing.Point(($screenBounds.Width - 450), 40)
$form.FormBorderStyle = "FixedToolWindow"
$form.TopMost = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42) # Slate-900
$form.ForeColor = [System.Drawing.Color]::White

# Dragging support
$form.Add_MouseDown({
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $form.Capture = $false
        $msg = [System.Windows.Forms.Message]::Create($form.Handle, 0xA1, [IntPtr]2, [IntPtr]0)
        $form.DefWndProc([ref]$msg)
    }
})

# Status Indicator Dot & Label
$statusDot = New-Object System.Windows.Forms.Label
$statusDot.Text = "[*]"
$statusDot.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$statusDot.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$statusDot.Location = New-Object System.Drawing.Point(10, 16)
$statusDot.Size = New-Object System.Drawing.Size(26, 24)
$form.Controls.Add($statusDot)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "Pronto para gravar"
$lblStatus.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$lblStatus.Location = New-Object System.Drawing.Point(38, 12)
$lblStatus.Size = New-Object System.Drawing.Size(125, 18)
$form.Controls.Add($lblStatus)

$lblCounter = New-Object System.Windows.Forms.Label
$lblCounter.Text = "Passos: 0"
$lblCounter.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$lblCounter.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$lblCounter.Location = New-Object System.Drawing.Point(38, 30)
$lblCounter.Size = New-Object System.Drawing.Size(120, 16)
$form.Controls.Add($lblCounter)

# Record / Pause Button
$btnRecord = New-Object System.Windows.Forms.Button
$btnRecord.Text = "Iniciar"
$btnRecord.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$btnRecord.BackColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
$btnRecord.ForeColor = [System.Drawing.Color]::White
$btnRecord.FlatStyle = "Flat"
$btnRecord.FlatAppearance.BorderSize = 0
$btnRecord.Location = New-Object System.Drawing.Point(165, 12)
$btnRecord.Size = New-Object System.Drawing.Size(85, 34)
$form.Controls.Add($btnRecord)

# Finish Button
$btnFinish = New-Object System.Windows.Forms.Button
$btnFinish.Text = "Concluir"
$btnFinish.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$btnFinish.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235)
$btnFinish.ForeColor = [System.Drawing.Color]::White
$btnFinish.FlatStyle = "Flat"
$btnFinish.FlatAppearance.BorderSize = 0
$btnFinish.Location = New-Object System.Drawing.Point(256, 12)
$btnFinish.Size = New-Object System.Drawing.Size(95, 34)
$btnFinish.Enabled = $false
$form.Controls.Add($btnFinish)

# Cancel Button
$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = "X"
$btnCancel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnCancel.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnCancel.ForeColor = [System.Drawing.Color]::White
$btnCancel.FlatStyle = "Flat"
$btnCancel.FlatAppearance.BorderSize = 0
$btnCancel.Location = New-Object System.Drawing.Point(358, 12)
$btnCancel.Size = New-Object System.Drawing.Size(34, 34)
$form.Controls.Add($btnCancel)

function Get-ActiveWindowTitle() {
    $hWnd = [Win32]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 256
    [Win32]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
    $t = $sb.ToString().Trim()
    if ([string]::IsNullOrWhiteSpace($t)) { return "Sistema em uso" }
    return $t
}

# Capture helper function for Mouse Click (with target ripple and computer mouse icon)
function Capture-ScreenWithClick([int]$clickX, [int]$clickY, [string]$windowTitle) {
    try {
        $screenBounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $rawBmp = New-Object System.Drawing.Bitmap($screenBounds.Width, $screenBounds.Height)
        $gRaw = [System.Drawing.Graphics]::FromImage($rawBmp)
        $gRaw.CopyFromScreen($screenBounds.Location, [System.Drawing.Point]::Empty, $screenBounds.Size)
        $gRaw.Dispose()

        # Convert raw to base64
        $msRaw = New-Object System.IO.MemoryStream
        $rawBmp.Save($msRaw, [System.Drawing.Imaging.ImageFormat]::Png)
        $rawBytes = $msRaw.ToArray()
        $msRaw.Dispose()
        $rawBase64 = "data:image/png;base64," + [System.Convert]::ToBase64String($rawBytes)

        # Create annotated image with mouse click icon & ripple
        $annotatedBmp = New-Object System.Drawing.Bitmap($rawBmp)
        $gAnn = [System.Drawing.Graphics]::FromImage($annotatedBmp)
        $gAnn.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

        # 1. Concentric red pulse circle
        $radius = 20
        $redBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45, 239, 68, 68))
        $gAnn.FillEllipse($redBrush, ($clickX - $radius), ($clickY - $radius), ($radius * 2), ($radius * 2))
        $redBrush.Dispose()

        $redPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(239, 68, 68), 3)
        $gAnn.DrawEllipse($redPen, ($clickX - $radius), ($clickY - $radius), ($radius * 2), ($radius * 2))
        $redPen.Dispose()

        $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 68, 68))
        $gAnn.FillEllipse($dotBrush, ($clickX - 3), ($clickY - 3), 6, 6)
        $dotBrush.Dispose()

        # 2. Vector Computer Mouse device with highlighted left button
        $mX = $clickX + 8
        $mY = $clickY + 8
        $mW = 20
        $mH = 28

        # Mouse shadow
        $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
        $gAnn.FillRectangle($shadowBrush, $mX + 2, $mY + 2, $mW, $mH)
        $shadowBrush.Dispose()

        # White mouse body
        $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $gAnn.FillRectangle($whiteBrush, $mX, $mY, $mW, $mH)
        $whiteBrush.Dispose()

        # Left button (highlighted red)
        $btnRed = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 68, 68))
        $gAnn.FillRectangle($btnRed, $mX, $mY, [int]($mW / 2), [int]($mH * 0.45))
        $btnRed.Dispose()

        # Right button (light gray)
        $btnGray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 245, 249))
        $gAnn.FillRectangle($btnGray, ($mX + [int]($mW / 2)), $mY, [int]($mW / 2), [int]($mH * 0.45))
        $btnGray.Dispose()

        # Outline & dividers
        $darkPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(15, 23, 42), 2)
        $gAnn.DrawRectangle($darkPen, $mX, $mY, $mW, $mH)
        $gAnn.DrawLine($darkPen, ($mX + [int]($mW / 2)), $mY, ($mX + [int]($mW / 2)), ($mY + [int]($mH * 0.45)))
        $gAnn.DrawLine($darkPen, $mX, ($mY + [int]($mH * 0.45)), ($mX + $mW), ($mY + [int]($mH * 0.45)))

        # Scroll wheel
        $wheelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(51, 65, 85))
        $gAnn.FillRectangle($wheelBrush, ($mX + [int]($mW / 2) - 1), ($mY + 3), 3, 5)
        $wheelBrush.Dispose()
        $darkPen.Dispose()
        $gAnn.Dispose()

        # Convert annotated to base64
        $msAnn = New-Object System.IO.MemoryStream
        $annotatedBmp.Save($msAnn, [System.Drawing.Imaging.ImageFormat]::Png)
        $annBytes = $msAnn.ToArray()
        $msAnn.Dispose()
        $annBase64 = "data:image/png;base64," + [System.Convert]::ToBase64String($annBytes)

        $rawBmp.Dispose()
        $annotatedBmp.Dispose()

        $stepObj = @{
            actionType = "click"
            imageBase64 = $annBase64
            originalImageBase64 = $rawBase64
            clickX = $clickX
            clickY = $clickY
            windowTitle = $windowTitle
            timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        }

        $global:steps.Add($stepObj) | Out-Null
        $lblCounter.Text = "Passos: " + $global:steps.Count

        try { [System.Media.SystemSounds]::Beep.Play() } catch {}
    } catch {
        Write-Warning ("Erro ao capturar tela de clique: " + $_.Exception.Message)
    }
}

# Capture helper function for Text Typing
function Capture-ScreenWithTyping([string]$typedText, [string]$windowTitle) {
    try {
        $screenBounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $rawBmp = New-Object System.Drawing.Bitmap($screenBounds.Width, $screenBounds.Height)
        $gRaw = [System.Drawing.Graphics]::FromImage($rawBmp)
        $gRaw.CopyFromScreen($screenBounds.Location, [System.Drawing.Point]::Empty, $screenBounds.Size)
        $gRaw.Dispose()

        $msRaw = New-Object System.IO.MemoryStream
        $rawBmp.Save($msRaw, [System.Drawing.Imaging.ImageFormat]::Png)
        $rawBytes = $msRaw.ToArray()
        $msRaw.Dispose()
        $rawBase64 = "data:image/png;base64," + [System.Convert]::ToBase64String($rawBytes)

        $annotatedBmp = New-Object System.Drawing.Bitmap($rawBmp)
        $gAnn = [System.Drawing.Graphics]::FromImage($annotatedBmp)
        $gAnn.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

        $pt = New-Object Win32+POINT
        [Win32]::GetCursorPos([ref]$pt) | Out-Null
        $bX = [Math]::Max(40, [Math]::Min($pt.X, ($screenBounds.Width - 360)))
        $bY = [Math]::Max(40, [Math]::Min(($pt.Y + 25), ($screenBounds.Height - 65)))

        $font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
        $badgeText = "Digitar: `"$typedText`""
        $textSize = $gAnn.MeasureString($badgeText, $font)
        $badgeW = [int]($textSize.Width + 30)
        $badgeH = 34

        $bgShadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
        $gAnn.FillRectangle($bgShadow, $bX + 3, $bY + 3, $badgeW, $badgeH)
        $bgShadow.Dispose()

        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42)) # Slate-900
        $gAnn.FillRectangle($bgBrush, $bX, $bY, $badgeW, $badgeH)
        $bgBrush.Dispose()

        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(2, 132, 199), 2) # Sky blue
        $gAnn.DrawRectangle($borderPen, $bX, $bY, $badgeW, $badgeH)
        $borderPen.Dispose()

        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $gAnn.DrawString($badgeText, $font, $textBrush, ($bX + 12), ($bY + 7))
        $textBrush.Dispose()
        $font.Dispose()
        $gAnn.Dispose()

        $msAnn = New-Object System.IO.MemoryStream
        $annotatedBmp.Save($msAnn, [System.Drawing.Imaging.ImageFormat]::Png)
        $annBytes = $msAnn.ToArray()
        $msAnn.Dispose()
        $annBase64 = "data:image/png;base64," + [System.Convert]::ToBase64String($annBytes)

        $rawBmp.Dispose()
        $annotatedBmp.Dispose()

        $stepObj = @{
            actionType = "typing"
            typedText = $typedText
            imageBase64 = $annBase64
            originalImageBase64 = $rawBase64
            clickX = $pt.X
            clickY = $pt.Y
            windowTitle = $windowTitle
            timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        }

        $global:steps.Add($stepObj) | Out-Null
        $lblCounter.Text = "Passos: " + $global:steps.Count

        try { [System.Media.SystemSounds]::Beep.Play() } catch {}
    } catch {
        Write-Warning ("Erro ao capturar tela de digitacao: " + $_.Exception.Message)
    }
}

# Capture helper function for Keyboard Shortcut / Hotkey
function Capture-ScreenWithHotkey([string]$hotkey, [string]$windowTitle) {
    try {
        $screenBounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $rawBmp = New-Object System.Drawing.Bitmap($screenBounds.Width, $screenBounds.Height)
        $gRaw = [System.Drawing.Graphics]::FromImage($rawBmp)
        $gRaw.CopyFromScreen($screenBounds.Location, [System.Drawing.Point]::Empty, $screenBounds.Size)
        $gRaw.Dispose()

        $msRaw = New-Object System.IO.MemoryStream
        $rawBmp.Save($msRaw, [System.Drawing.Imaging.ImageFormat]::Png)
        $rawBytes = $msRaw.ToArray()
        $msRaw.Dispose()
        $rawBase64 = "data:image/png;base64," + [System.Convert]::ToBase64String($rawBytes)

        $annotatedBmp = New-Object System.Drawing.Bitmap($rawBmp)
        $gAnn = [System.Drawing.Graphics]::FromImage($annotatedBmp)
        $gAnn.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

        $pt = New-Object Win32+POINT
        [Win32]::GetCursorPos([ref]$pt) | Out-Null
        $bX = [Math]::Max(40, [Math]::Min($pt.X, ($screenBounds.Width - 300)))
        $bY = [Math]::Max(40, [Math]::Min(($pt.Y + 25), ($screenBounds.Height - 65)))

        $font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
        $badgeText = "Atalho: [$hotkey]"
        $textSize = $gAnn.MeasureString($badgeText, $font)
        $badgeW = [int]($textSize.Width + 30)
        $badgeH = 34

        $bgShadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
        $gAnn.FillRectangle($bgShadow, $bX + 3, $bY + 3, $badgeW, $badgeH)
        $bgShadow.Dispose()

        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42)) # Slate-900
        $gAnn.FillRectangle($bgBrush, $bX, $bY, $badgeW, $badgeH)
        $bgBrush.Dispose()

        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(217, 119, 6), 2) # Amber-600
        $gAnn.DrawRectangle($borderPen, $bX, $bY, $badgeW, $badgeH)
        $borderPen.Dispose()

        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(254, 240, 138)) # Amber-200
        $gAnn.DrawString($badgeText, $font, $textBrush, ($bX + 12), ($bY + 7))
        $textBrush.Dispose()
        $font.Dispose()
        $gAnn.Dispose()

        $msAnn = New-Object System.IO.MemoryStream
        $annotatedBmp.Save($msAnn, [System.Drawing.Imaging.ImageFormat]::Png)
        $annBytes = $msAnn.ToArray()
        $msAnn.Dispose()
        $annBase64 = "data:image/png;base64," + [System.Convert]::ToBase64String($annBytes)

        $rawBmp.Dispose()
        $annotatedBmp.Dispose()

        $stepObj = @{
            actionType = "hotkey"
            hotkey = $hotkey
            imageBase64 = $annBase64
            originalImageBase64 = $rawBase64
            clickX = $pt.X
            clickY = $pt.Y
            windowTitle = $windowTitle
            timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        }

        $global:steps.Add($stepObj) | Out-Null
        $lblCounter.Text = "Passos: " + $global:steps.Count

        try { [System.Media.SystemSounds]::Beep.Play() } catch {}
    } catch {
        Write-Warning ("Erro ao capturar tela de atalho: " + $_.Exception.Message)
    }
}

function Flush-TypingBuffer() {
    $text = $global:typingBuffer.Trim()
    $global:typingBuffer = ""
    if ([string]::IsNullOrWhiteSpace($text)) { return }

    $winTitle = Get-ActiveWindowTitle
    Capture-ScreenWithTyping -typedText $text -windowTitle $winTitle
    if ($global:isRecording) {
        $lblStatus.Text = "Gravando..."
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(248, 113, 113)
    }
}

# Input polling timer (checks for mouse clicks, keyboard commands and typing)
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 35 # 35ms polling for real-time responsiveness

$timer.Add_Tick({
    if (-not $global:isRecording) { return }

    $isCtrl = [Win32]::IsKeyDown(0x11)
    $isAlt = [Win32]::IsKeyDown(0x12)
    $isShift = [Win32]::IsKeyDown(0x10)
    $isWin = [Win32]::IsKeyDown(0x5B) -or [Win32]::IsKeyDown(0x5C)

    # 1. Check Left Mouse Button (VK_LBUTTON = 0x01)
    if ([Win32]::KeyJustPressed(0x01)) {
        $pt = New-Object Win32+POINT
        [Win32]::GetCursorPos([ref]$pt) | Out-Null

        # Ignore click if it's inside the recorder control form
        if ($pt.X -ge $form.Left -and $pt.X -le ($form.Left + $form.Width) -and
            $pt.Y -ge $form.Top -and $pt.Y -le ($form.Top + $form.Height)) {
            return
        }

        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        if (($now - $global:lastClickTime) -lt 300) { return }
        $global:lastClickTime = $now

        Flush-TypingBuffer

        $winTitle = Get-ActiveWindowTitle
        Start-Sleep -Milliseconds 60
        Capture-ScreenWithClick -clickX $pt.X -clickY $pt.Y -windowTitle $winTitle
        return
    }

    # 2. Check for Keyboard Shortcuts / Hotkeys (when Ctrl, Alt, or Win is held)
    if ($isCtrl -or $isAlt -or $isWin) {
        foreach ($k in 0x41..0x5A + 0x30..0x39 + 0x70..0x7B + 0x0D + 0x09 + 0x1B + 0x2E) {
            if ([Win32]::KeyJustPressed($k)) {
                $modStr = ""
                if ($isCtrl) { $modStr += "Ctrl + " }
                if ($isAlt) { $modStr += "Alt + " }
                if ($isShift) { $modStr += "Shift + " }
                if ($isWin) { $modStr += "Win + " }

                $kName = [Win32]::GetKeyName($k)
                if (-not $kName) { $kName = [System.Windows.Forms.Keys]$k }
                $hotkey = "$modStr$kName"

                Flush-TypingBuffer

                $winTitle = Get-ActiveWindowTitle
                Start-Sleep -Milliseconds 80
                Capture-ScreenWithHotkey -hotkey $hotkey -windowTitle $winTitle
                return
            }
        }
        return
    }

    # 3. Standalone command keys (Enter, Tab, Esc, F1-F12)
    if ([Win32]::KeyJustPressed(0x0D)) { # Enter
        Flush-TypingBuffer
        $winTitle = Get-ActiveWindowTitle
        Start-Sleep -Milliseconds 60
        Capture-ScreenWithHotkey -hotkey "Enter" -windowTitle $winTitle
        return
    }
    if ([Win32]::KeyJustPressed(0x09)) { # Tab
        Flush-TypingBuffer
        $winTitle = Get-ActiveWindowTitle
        Start-Sleep -Milliseconds 60
        Capture-ScreenWithHotkey -hotkey "Tab" -windowTitle $winTitle
        return
    }
    if ([Win32]::KeyJustPressed(0x1B)) { # Esc
        Flush-TypingBuffer
        $winTitle = Get-ActiveWindowTitle
        Start-Sleep -Milliseconds 60
        Capture-ScreenWithHotkey -hotkey "Esc" -windowTitle $winTitle
        return
    }
    foreach ($fKey in 0x70..0x7B) { # F1 to F12
        if ([Win32]::KeyJustPressed($fKey)) {
            Flush-TypingBuffer
            $kName = [Win32]::GetKeyName($fKey)
            $winTitle = Get-ActiveWindowTitle
            Start-Sleep -Milliseconds 60
            Capture-ScreenWithHotkey -hotkey "$kName" -windowTitle $winTitle
            return
        }
    }

    # 4. Text Typing detection (A-Z, 0-9, space, backspace, punctuation)
    if ([Win32]::KeyJustPressed(0x20)) { # Space
        $global:typingBuffer += " "
        $global:lastTypingTime = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $lblStatus.Text = "Digitando..."
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(56, 189, 248)
    }
    if ([Win32]::KeyJustPressed(0x08)) { # Backspace
        if ($global:typingBuffer.Length -gt 0) {
            $global:typingBuffer = $global:typingBuffer.Substring(0, $global:typingBuffer.Length - 1)
            $global:lastTypingTime = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        }
    }
    foreach ($vk in 0x41..0x5A + 0x30..0x39 + 0xBC + 0xBE + 0xBD + 0xBF + 0xBA + 0xBB + 0xDE) {
        if ([Win32]::KeyJustPressed($vk)) {
            $ch = [Win32]::GetTypedChar($vk, $isShift)
            if ($ch) {
                $global:typingBuffer += $ch
                $global:lastTypingTime = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                $lblStatus.Text = "Digitando..."
                $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(56, 189, 248)
            }
        }
    }

    # 5. Flush typing buffer if user stopped typing for 1200ms
    if ($global:typingBuffer.Length -gt 0) {
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        if (($now - $global:lastTypingTime) -ge 1200) {
            Flush-TypingBuffer
        }
    }
})

# Button Events
$btnRecord.Add_Click({
    if (-not $global:isRecording) {
        $global:isRecording = $true
        [Win32]::ResetKeys()
        $statusDot.Text = "[REC]"
        $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(239, 68, 68)
        $lblStatus.Text = "Gravando..."
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(248, 113, 113)
        $btnRecord.Text = "Pausar"
        $btnRecord.BackColor = [System.Drawing.Color]::FromArgb(202, 138, 4) # Amber
        $btnFinish.Enabled = $true
        $timer.Start()
    } else {
        Flush-TypingBuffer
        $global:isRecording = $false
        $statusDot.Text = "[||]"
        $statusDot.ForeColor = [System.Drawing.Color]::FromArgb(234, 179, 8)
        $lblStatus.Text = "Pausado"
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(253, 224, 71)
        $btnRecord.Text = "Continuar"
        $btnRecord.BackColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
    }
})

$btnFinish.Add_Click({
    Flush-TypingBuffer

    if ($global:steps.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            "Nenhum passo foi gravado ainda. Clique nos botoes, digite ou pressione atalhos que deseja incluir no manual antes de concluir.",
            "Gravador de Passos",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
        return
    }

    $global:isRecording = $false
    $timer.Stop()

    # Dialog for AI Procedure Briefing & Confirmation
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = "GuiaMaker Pro - Briefing para a IA"
    $dlg.Size = New-Object System.Drawing.Size(490, 375)
    $dlg.StartPosition = "CenterScreen"
    $dlg.FormBorderStyle = "FixedDialog"
    $dlg.MaximizeBox = $false
    $dlg.MinimizeBox = $false
    $dlg.TopMost = $true
    $dlg.BackColor = [System.Drawing.Color]::White

    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = "Explique para a IA sobre o que e este passo a passo:"
    $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
    $lblTitle.Location = New-Object System.Drawing.Point(18, 14)
    $lblTitle.Size = New-Object System.Drawing.Size(440, 22)
    $dlg.Controls.Add($lblTitle)

    $lblSub = New-Object System.Windows.Forms.Label
    $lblSub.Text = "A IA usara esta explicacao para organizar os passos, gerar o titulo e detalhar as instrucoes tecnicas de cada clique."
    $lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 8.0)
    $lblSub.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
    $lblSub.Location = New-Object System.Drawing.Point(18, 38)
    $lblSub.Size = New-Object System.Drawing.Size(440, 30)
    $dlg.Controls.Add($lblSub)

    $txtContext = New-Object System.Windows.Forms.TextBox
    $txtContext.Multiline = $true
    $txtContext.ScrollBars = "Vertical"
    $txtContext.Text = $global:procedureContext
    $txtContext.Font = New-Object System.Drawing.Font("Segoe UI", 9.0)
    $txtContext.Location = New-Object System.Drawing.Point(18, 72)
    $txtContext.Size = New-Object System.Drawing.Size(438, 120)
    $dlg.Controls.Add($txtContext)

    $lblSys = New-Object System.Windows.Forms.Label
    $lblSys.Text = "Sistema / Modulo:"
    $lblSys.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $lblSys.Location = New-Object System.Drawing.Point(18, 206)
    $lblSys.Size = New-Object System.Drawing.Size(130, 20)
    $dlg.Controls.Add($lblSys)

    $txtSys = New-Object System.Windows.Forms.TextBox
    $txtSys.Text = $global:systemName
    $txtSys.Font = New-Object System.Drawing.Font("Segoe UI", 9.0)
    $txtSys.Location = New-Object System.Drawing.Point(18, 228)
    $txtSys.Size = New-Object System.Drawing.Size(438, 24)
    $dlg.Controls.Add($txtSys)

    $btnOk = New-Object System.Windows.Forms.Button
    $btnOk.Text = "Concluir e Gerar com IA"
    $btnOk.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $btnOk.Font = New-Object System.Drawing.Font("Segoe UI", 9.0, [System.Drawing.FontStyle]::Bold)
    $btnOk.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235)
    $btnOk.ForeColor = [System.Drawing.Color]::White
    $btnOk.FlatStyle = "Flat"
    $btnOk.FlatAppearance.BorderSize = 0
    $btnOk.Location = New-Object System.Drawing.Point(266, 274)
    $btnOk.Size = New-Object System.Drawing.Size(190, 36)
    $dlg.Controls.Add($btnOk)
    $dlg.AcceptButton = $btnOk

    $btnSkip = New-Object System.Windows.Forms.Button
    $btnSkip.Text = "Voltar a Gravar"
    $btnSkip.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $btnSkip.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
    $btnSkip.Location = New-Object System.Drawing.Point(145, 274)
    $btnSkip.Size = New-Object System.Drawing.Size(110, 36)
    $dlg.Controls.Add($btnSkip)

    $res = $dlg.ShowDialog()
    if ($res -ne [System.Windows.Forms.DialogResult]::OK) {
        $btnRecord.Enabled = $true
        $btnFinish.Enabled = $true
        return
    }

    $global:procedureContext = $txtContext.Text.Trim()
    $global:systemName = $txtSys.Text.Trim()

    $lblStatus.Text = "Enviando..."
    $btnRecord.Enabled = $false
    $btnFinish.Enabled = $false
    $form.Refresh()

    try {
        $payloadObj = @{
            title = $global:tutorialTitle
            systemName = $global:systemName
            author = "Gravador de Passos"
            geminiApiKey = $global:geminiKey
            procedureContext = $global:procedureContext
            steps = $global:steps
        }

        $jsonPayload = $payloadObj | ConvertTo-Json -Depth 5 -Compress
        $endpoint = "$($global:appServerUrl)/api/recorder/import"

        $response = Invoke-RestMethod -Uri $endpoint -Method Post -Body $jsonPayload -ContentType "application/json; charset=utf-8"

        if ($response.success) {
            $redirect = $response.redirectUrl
            $fullUrl = "$($global:appServerUrl)$redirect"

            # Open browser directly to the newly recorded tutorial
            Start-Process $fullUrl

            [System.Windows.Forms.MessageBox]::Show(
                "Gravacao concluida com sucesso!`nTotal de passos capturados: $($global:steps.Count)`n`nO GuiaMaker Pro foi aberto no navegador para voce revisar e editar.",
                "Tutorial Gerado",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
            $form.Close()
        } else {
            throw "O servidor nao retornou status de sucesso."
        }
    } catch {
        $errDetail = $_.Exception.Message
        [System.Windows.Forms.MessageBox]::Show(
            "Nao foi possivel enviar os passos para o servidor em $($global:appServerUrl).`n`nErro: $errDetail`n`nVerifique se o GuiaMaker Pro esta rodando na porta correta.",
            "Erro de Conexao",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        $btnRecord.Enabled = $true
        $btnFinish.Enabled = $true
        $lblStatus.Text = "Pausado"
    }
})

$btnCancel.Add_Click({
    if ($global:steps.Count -gt 0) {
        $res = [System.Windows.Forms.MessageBox]::Show(
            "Deseja descartar os passos gravados e fechar o gravador?",
            "Cancelar Gravacao",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($res -ne [System.Windows.Forms.DialogResult]::Yes) { return }
    }
    $global:isRecording = $false
    $timer.Stop()
    $form.Close()
})

# Show dialog
[System.Windows.Forms.Application]::Run($form)
