# キャラクターデザイン画像の配置ガイド

このフォルダに画像を置くと、アプリのキャラデザ画面で犬種を切り替えられます。
画像がない犬種は自動的に SVG にフォールバックします。

## ファイル配置ルール

```
assets/designs/<designId>/
  stage-0.png   (こいぬ)
  stage-1.png   (わんこ)
  stage-2.png   (立派な犬)
  stage-3.png   (忠犬)
  stage-4.png   (伝説の犬)
```

各 `designId` はコードで決め打ち。現在は4種：

| designId | 表示名 | 方向性 |
|---|---|---|
| `shiba` | 柴犬 | 茶+白、巻き尾、立ち耳、日本犬らしい顔 |
| `poodle` | プードル | 白もこもこ、くりくりの毛、上品 |
| `black-shiba` | 黒柴 | 黒+茶タン、精悍、ワイルド |
| `dalmatian` | ダルメシアン | 白に黒ぶち、スマート、シュッとしてる |

## 画像スペック

- **サイズ**: 512 × 512 px（推奨。表示時に`object-fit: contain`で縮小）
- **フォーマット**: PNG
- **背景**: 透過（必須）。白背景はNG。Gemini に「transparent background, NO white square, NO card frame」を毎回入れる
- **ポーズ**: 正面向き、全身、中央配置
- **スタイル**: ちょこんと座ってるか立ってる。ステージが進むにつれ大人っぽく、装飾が増える

## ステージごとの方向性

| Stage | 名前 | デザイン指針 |
|---|---|---|
| 0 | こいぬ | 小さめ、頭が大きい、耳が垂れる、無邪気な目、あどけない |
| 1 | わんこ | 子犬から脱皮、耳が少し立つ、赤い首輪を追加 |
| 2 | 立派な犬 | 体がしっかり、耳ピン、鋲付きの首輪 |
| 3 | 忠犬 | 胸元の毛量アップ、赤い首輪＋金メダル、凛々しい表情 |
| 4 | 伝説の犬 | 後光（halo）、金の王冠、翼（光）、宝石付きの青い首輪、圧倒的オーラ |

## Gemini プロンプト例

### 柴犬 stage-0（こいぬ）
```
A chibi-style puppy Shiba Inu with big round eyes, small floppy ears,
cream and light-brown fur, sitting pose, front-facing, full body visible.
Thick black outline, flat colors with simple gradient shading. Cute
kawaii style. Transparent PNG background — NO white square, NO card
frame, NO colored backdrop. Only the puppy itself. 512x512px, centered.
```

### 柴犬 stage-4（伝説の犬）
```
A majestic legendary Shiba Inu with glowing golden halo above, golden
crown studded with red and blue gems, ethereal white glowing wings,
blue gemmed collar, standing proudly, front-facing, full body. Same
chibi kawaii style as the puppy version. Thick black outline, vibrant
shading. Transparent PNG background — NO white square, NO frame. Only
the dog and its halo/wings/crown. 512x512px, centered.
```

### プードル stage-0
```
A chibi-style puppy Poodle with big sparkly eyes, curly fluffy white
fur, small fluffy ears, tiny pom-pom tail, sitting pose. Thick black
outline, soft pink blush on cheeks. Kawaii style. Transparent PNG
background — NO white square, NO card. 512x512px, centered.
```

### 黒柴 stage-2
```
A chibi-style strong adult black Shiba Inu with dark charcoal fur and
tan markings on cheeks/chest/paws, pointed upright ears, sturdy stance,
studded leather collar. Thick black outline, dramatic lighting.
Transparent PNG background. 512x512px, centered.
```

### ダルメシアン stage-3
```
A chibi-style noble adult Dalmatian with bright white short fur covered
in scattered black spots, pointed ears, slim elegant build, red collar
with golden medal hanging, proud expression. Thick black outline.
Transparent PNG background. 512x512px, centered.
```

→ 他のステージも同じ要領で「chibi-style + 犬種 + その stage の特徴」を
組み合わせるだけ。全 **4犬種 × 5ステージ = 20枚** で完成。

## 終わったら

画像を配置してページをリロードするだけ。アプリ側は自動でピックアップします。
GitHub に push すれば Pages 経由でも反映。
