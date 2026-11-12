param(
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\public\icon-512.png')
)

Add-Type -AssemblyName System.Drawing
$output = [System.IO.Path]::GetFullPath($OutputPath)
$directory = [System.IO.Path]::GetDirectoryName($output)
[System.IO.Directory]::CreateDirectory($directory) | Out-Null

$bitmap = [System.Drawing.Bitmap]::new(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

function New-Brush([string]$start, [string]$end, [int]$x, [int]$y, [int]$width, [int]$height) {
  [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new($x, $y, $width, $height),
    [System.Drawing.ColorTranslator]::FromHtml($start),
    [System.Drawing.ColorTranslator]::FromHtml($end),
    48
  )
}

$background = New-Brush '#07162e' '#160d2b' 0 0 512 512
$graphics.FillRectangle($background, 0, 0, 512, 512)
$background.Dispose()

$stars = @(@(74,89,3), @(132,58,2), @(215,105,3), @(419,92,3), @(463,175,2), @(77,246,2), @(422,314,3), @(93,417,2), @(364,447,2))
foreach ($star in $stars) {
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(195, 217, 247, 255))
  $graphics.FillEllipse($brush, $star[0] - $star[2], $star[1] - $star[2], $star[2] * 2, $star[2] * 2)
  $brush.Dispose()
}

# Black-hole accretion disk: several offset luminous rings give a readable silhouette at icon scale.
$center = [System.Drawing.PointF]::new(343, 205)
$matrix = [System.Drawing.Drawing2D.Matrix]::new()
$matrix.RotateAt(-14, $center)
$graphics.Transform = $matrix
foreach ($ring in @(@(160,58,18,44), @(148,50,14,95), @(137,43,10,160))) {
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($ring[3], 105, 188, 250), $ring[2])
  $graphics.DrawEllipse($pen, $center.X - $ring[0], $center.Y - $ring[1], $ring[0] * 2, $ring[1] * 2)
  $pen.Dispose()
}
$hotPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(240, 224, 250, 255), 8)
$graphics.DrawArc($hotPen, $center.X - 128, $center.Y - 38, 256, 76, 183, 162)
$hotPen.Dispose()
$void = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(3, 5, 12))
$graphics.FillEllipse($void, $center.X - 74, $center.Y - 74, 148, 148)
$void.Dispose()
$rim = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(155, 140, 211, 248), 5)
$graphics.DrawEllipse($rim, $center.X - 79, $center.Y - 79, 158, 158)
$rim.Dispose()
$graphics.ResetTransform()
$matrix.Dispose()

$planet = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#142d4d'))
$graphics.FillPie($planet, -130, 407, 430, 250, 196, 164)
$planet.Dispose()
$surface = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(170, 91, 156, 192), 4)
$graphics.DrawArc($surface, -120, 426, 410, 185, 196, 156)
$surface.Dispose()

# Flight trajectory and ship.
$trajectory = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(135, 167, 239, 255), 4)
$trajectory.DashPattern = @(5, 13)
$trajectory.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$trajectory.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawBezier($trajectory, 45, 326, 104, 300, 174, 267, 239, 235)
$trajectory.Dispose()

$shipCenter = [System.Drawing.PointF]::new(164, 310)
$shipMatrix = [System.Drawing.Drawing2D.Matrix]::new()
$shipMatrix.RotateAt(18, $shipCenter)
$graphics.Transform = $shipMatrix
$engine = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(170, 255, 167, 84))
$graphics.FillPolygon($engine, [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(164,390),[System.Drawing.PointF]::new(128,354),[System.Drawing.PointF]::new(200,354)))
$engine.Dispose()
$hull = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#b5e6ec'))
$hullOutline = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#efffff'), 5)
$graphics.FillPolygon($hull, [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(127,369),[System.Drawing.PointF]::new(164,226),[System.Drawing.PointF]::new(201,369),[System.Drawing.PointF]::new(186,398),[System.Drawing.PointF]::new(142,398)))
$graphics.DrawPolygon($hullOutline, [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(127,369),[System.Drawing.PointF]::new(164,226),[System.Drawing.PointF]::new(201,369),[System.Drawing.PointF]::new(186,398),[System.Drawing.PointF]::new(142,398)))
$hull.Dispose(); $hullOutline.Dispose()
$wing = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#6099b8'))
$wingPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#d5f9ff'), 4)
$leftWing = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(142,363),[System.Drawing.PointF]::new(102,391),[System.Drawing.PointF]::new(128,346))
$rightWing = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(186,363),[System.Drawing.PointF]::new(226,391),[System.Drawing.PointF]::new(200,346))
$graphics.FillPolygon($wing, $leftWing); $graphics.FillPolygon($wing, $rightWing); $graphics.DrawPolygon($wingPen, $leftWing); $graphics.DrawPolygon($wingPen, $rightWing)
$wing.Dispose(); $wingPen.Dispose()
$window = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#102c4b'))
$graphics.FillPie($window, 144, 259, 40, 45, 180, 180)
$window.Dispose()
$leg = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#d9faff'), 7)
$leg.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $leg.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($leg, 127, 369, 104, 402); $graphics.DrawLine($leg, 201, 369, 224, 402)
$leg.Dispose()
$graphics.ResetTransform(); $shipMatrix.Dispose()

$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose()
Write-Output "Generated $output"
