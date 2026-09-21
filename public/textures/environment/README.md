# Arena concrete textures

Source assets from Poly Haven, licensed CC0:

- `floor-*`: [Concrete Floor](https://polyhaven.com/a/concrete_floor), eye-candy.xyz, 2.1 m tile.
- `wall-*`: [Concrete](https://polyhaven.com/a/concrete), Rob Tuytel, 4 m tile.
- License: https://polyhaven.com/license

The supplied 2K diffuse, OpenGL normal and roughness PNGs were downloaded from
Poly Haven and checked against the file API's MD5 checksums. Runtime copies use
2048 x 2048 pixels: diffuse is WebP quality 90, normals are 8-bit RGB PNG, and
roughness is 8-bit grayscale PNG. Floor saturation is reduced in the material
shader; the relief and roughness data retain the original orientation.

These files are served locally. No Poly Haven requests are made during gameplay.
