# Builds the derived layers for the photo models from the generated PNG sources in art/models.
# Usage (Windows PowerShell, from apps/web): .\scripts\derive-model-layers.ps1 -Dir .\art\models
# Then run `npm run images` to regenerate the shipped WebP files in public/assets.
# Outputs: pocket-stereo-base.png (keys cleared), boombox-base.png (volume knob removed),
#          suitcase-base.png (tonearm removed) and suitcase-arm.png (the tonearm, matted).
# Coordinates are pixels in the 1536x1024 photos; see src/components/machines/photo.tsx for how each layer is used.
param([string]$Dir)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public class Px {
  public int W, H; public byte[] D;
  public Px(Bitmap b){ W=b.Width; H=b.Height; var r=b.LockBits(new Rectangle(0,0,W,H),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb); D=new byte[W*H*4]; Marshal.Copy(r.Scan0,D,0,D.Length); b.UnlockBits(r); }
  public Px(int w,int h){ W=w; H=h; D=new byte[w*h*4]; }
  public Px Clone(){ var p=new Px(W,H); Buffer.BlockCopy(D,0,p.D,0,D.Length); return p; }
  public int I(int x,int y){ return (y*W+x)*4; }
  public void Save(string f){ var b=new Bitmap(W,H,PixelFormat.Format32bppArgb); var r=b.LockBits(new Rectangle(0,0,W,H),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb); Marshal.Copy(D,0,r.Scan0,D.Length); b.UnlockBits(r); b.Save(f,ImageFormat.Png); b.Dispose(); }
  public void ClearRect(int x0,int y0,int x1,int y1){ for(int y=y0;y<=y1;y++) for(int x=x0;x<=x1;x++){ int i=I(x,y); D[i]=D[i+1]=D[i+2]=D[i+3]=0; } }
  public void CopyColumn(int fromX,int toX,int y0,int y1){ for(int y=y0;y<=y1;y++){ int a=I(fromX,y), b=I(toX,y); for(int k=0;k<4;k++) D[b+k]=D[a+k]; } }
  // Fill masked runs in each column by interpolating between the pixels just above and below the run.
  double Lum(int i){ return 0.11*D[i]+0.59*D[i+1]+0.3*D[i+2]; }
  // Copy only pixels that are clearly darker than the destination (engraved marks), not the plate around them.
  public void CopyDark(int fromX,int toX,int y0,int y1,double margin){ for(int y=y0;y<=y1;y++){ int a=I(fromX,y), b=I(toX,y); if(Lum(a)<Lum(b)-margin) for(int k=0;k<4;k++) D[b+k]=D[a+k]; } }
  public bool Cream(int x,int y){ int i=I(x,y); int b=D[i],g=D[i+1],r=D[i+2]; return r>165 && g>145 && b>100 && r-b>25; }
  // Blend each row of [x0,x1] between the columns just outside it (keeps horizontal shading gradients).
  public void BlendRows(int x0,int x1,int y0,int y1){ for(int y=y0;y<=y1;y++){ int a=I(x0-1,y), b=I(x1+1,y); for(int x=x0;x<=x1;x++){ double t=(x-x0+1.0)/(x1-x0+2.0); int c=I(x,y); for(int k=0;k<4;k++) D[c+k]=(byte)Math.Round(D[a+k]*(1-t)+D[b+k]*t); } } }
  // Platter-side pixels: blend along the rim ellipse (centre cx,cy; radius R; ratio k) between the nearest unmasked angles.
  // Deck pixels: blend between the nearest unmasked cream pixels on the same row.
  public void InpaintPlatter(bool[] mask,double cx,double cy,double R,double k,double side,int x0,int x1,int y0,int y1){
    var src=Clone();
    for(int y=y0;y<=y1;y++) for(int x=x0;x<=x1;x++){
      if(!mask[y*W+x]) continue;
      double c=(x-cx)/R; double top=-1;
      if(Math.Abs(c)<1){ double s=Math.Sqrt(1-c*c); top=cy+k*R*s; }
      double h=y-top; int o=I(x,y);
      if(top>0 && h>=-2 && h<=side){
        double a=Math.Acos(c); double lo=double.NaN, hi=double.NaN; int[] pl=null, ph=null;
        for(double d=0.004; d<1.2; d+=0.004){
          if(double.IsNaN(lo)){ double aa=a-d; int sx=(int)Math.Round(cx+R*Math.Cos(aa)), sy=(int)Math.Round(cy+k*R*Math.Sin(aa)+h); if(sx>=0&&sx<W&&sy>=0&&sy<H&&!mask[sy*W+sx]){ lo=d; pl=new[]{sx,sy}; } }
          if(double.IsNaN(hi)){ double aa=a+d; int sx=(int)Math.Round(cx+R*Math.Cos(aa)), sy=(int)Math.Round(cy+k*R*Math.Sin(aa)+h); if(sx>=0&&sx<W&&sy>=0&&sy<H&&!mask[sy*W+sx]){ hi=d; ph=new[]{sx,sy}; } }
          if(!double.IsNaN(lo)&&!double.IsNaN(hi)) break;
        }
        if(pl!=null&&ph!=null){ double t=lo/(lo+hi); int p=src.I(pl[0],pl[1]), q=src.I(ph[0],ph[1]); for(int n=0;n<4;n++) D[o+n]=(byte)Math.Round(src.D[p+n]*(1-t)+src.D[q+n]*t); continue; }
      }
      int lx=x-1; while(lx>0 && (mask[y*W+lx] || !src.Cream(lx,y))) lx--;
      int rx=x+1; while(rx<W-1 && (mask[y*W+rx] || !src.Cream(rx,y))) rx++;
      double tt=(x-lx)/(double)(rx-lx); int pa=src.I(lx,y), pb=src.I(rx,y);
      for(int n=0;n<4;n++) D[o+n]=(byte)Math.Round(src.D[pa+n]*(1-tt)+src.D[pb+n]*tt);
    }
  }
  public static bool InPoly(double px,double py,double[] xs,double[] ys){ bool c=false; for(int i=0,j=xs.Length-1;i<xs.Length;j=i++){ if(((ys[i]>py)!=(ys[j]>py)) && (px<(xs[j]-xs[i])*(py-ys[i])/(ys[j]-ys[i])+xs[i])) c=!c; } return c; }
  public void InpaintColumns(bool[] mask){ for(int x=0;x<W;x++){ int y=0; while(y<H){ if(!mask[y*W+x]){ y++; continue; } int s=y; while(y<H && mask[y*W+x]) y++; int e=y-1; int a=I(x,Math.Max(0,s-2)), b=I(x,Math.Min(H-1,e+2)); for(int yy=s;yy<=e;yy++){ double t=(yy-s+1.0)/(e-s+2.0); int c=I(x,yy); for(int k=0;k<4;k++) D[c+k]=(byte)Math.Round(D[a+k]*(1-t)+D[b+k]*t); } } } }
}
"@

function Load($f) { $b = [System.Drawing.Bitmap]::FromFile($f); $p = New-Object Px $b; $b.Dispose(); $p }

# Pocket Stereo: clear the four top keys so their photo cut-outs can slide down into the body.
$pocket = Load "$Dir\pocket-stereo.png"
$base = $pocket.Clone()
foreach ($k in @(@(226, 84, 341, 170), @(357, 82, 467, 170), @(487, 80, 623, 170), @(645, 82, 763, 170))) { $base.ClearRect($k[0], $k[1], $k[2], $k[3]) }
$base.Save("$Dir\pocket-stereo-base.png")

# Boombox: remove the volume knob. The plate is brushed horizontally, so a clean column repeats seamlessly;
# then restore the two scale ticks the knob was hiding (copied from the tick at x=728, mirrored spacing about the centre tick).
$boom = Load "$Dir\boombox.png"
$bb = $boom.Clone()
$bb.BlendRows(770, 886, 822, 904)
foreach ($tx in 802, 833, 864) { for ($d = -2; $d -le 2; $d++) { $bb.CopyDark(728 + $d, $tx + $d, 868, 892, 25) } }
$bb.Save("$Dir\boombox-base.png")

# Suitcase: lift the tonearm (tube + headshell + its contact shadow) out of the photo.
$suit = Load "$Dir\suitcase-rest.png"
$W = $suit.W; $H = $suit.H
$mask = New-Object 'bool[]' ($W * $H)
[double[]]$hx = 946, 1058, 1092, 1094, 1004, 962, 944
[double[]]$hy = 630, 576, 590, 644, 696, 696, 664
for ($x = 940; $x -le 1226; $x++) {
  $cy = 554 - 0.758 * ($x - 1120)
  for ($y = 440; $y -le 700; $y++) {
    $tube = ($x -ge 1050) -and ($x -le 1224) -and ($y -ge $cy - 15) -and ($y -le $cy + 20)
    if ($tube -or [Px]::InPoly($x, $y, $hx, $hy)) { $mask[$y * $W + $x] = $true }
  }
}
# Headshell region (rim + deck) first, then the thin tube by columns (it only crosses the deck and the black rest post).
$headMask = New-Object 'bool[]' ($W * $H); $tubeMask = New-Object 'bool[]' ($W * $H)
for ($y = 440; $y -le 700; $y++) { for ($x = 940; $x -le 1226; $x++) { if ($mask[$y * $W + $x]) { if ([Px]::InPoly($x, $y, $hx, $hy)) { $headMask[$y * $W + $x] = $true } else { $tubeMask[$y * $W + $x] = $true } } } }
$sb = $suit.Clone(); $sb.InpaintPlatter($headMask, 659, 510, 360, 0.381, 46, 940, 1100, 570, 700); $sb.InpaintColumns($tubeMask); $sb.Save("$Dir\suitcase-base.png")
# Matte the arm against the inpainted background: alpha from colour difference, colour un-mixed from the background.
$arm = New-Object Px $W, $H
for ($y = 440; $y -le 700; $y++) { for ($x = 940; $x -le 1226; $x++) {
  if (-not $mask[$y * $W + $x]) { continue }
  $i = $suit.I($x, $y)
  $dist = [Math]::Sqrt([Math]::Pow($suit.D[$i] - $sb.D[$i], 2) + [Math]::Pow($suit.D[$i + 1] - $sb.D[$i + 1], 2) + [Math]::Pow($suit.D[$i + 2] - $sb.D[$i + 2], 2))
  $a = [Math]::Min(1, [Math]::Max(0, ($dist - 20) / 40))
  if ($a -le 0) { continue }
  for ($k = 0; $k -lt 3; $k++) { $v = ($suit.D[$i + $k] - (1 - $a) * $sb.D[$i + $k]) / $a; $arm.D[$i + $k] = [byte][Math]::Min(255, [Math]::Max(0, [Math]::Round($v))) }
  $arm.D[$i + 3] = [byte][Math]::Round(255 * $a)
} }
$arm.Save("$Dir\suitcase-arm.png")
"done"
