const fs = require('fs');
let file = 'C:\\Proyectos\\app\\DogCatiFy\\app\\(tabs)\\index.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the DogCatiFyGameBanner import with FloatingGameWidget
content = content.replace("import { DogCatiFyGameBanner } from '../../components/DogCatiFyGameBanner';", "import { FloatingGameWidget } from '../../components/FloatingGameWidget';");

// Remove DogCatiFyGameBanner from straight inside the code
content = content.replace("<DogCatiFyGameBanner />", "");

// Wrap main return with View or Fragment so we can append absolute widget
const returnStart = "return (";
const returnContentOriginalStart = "<SafeAreaView style={styles.container}>";
const injectedReturn = "return (\n    <>\n      <SafeAreaView style={styles.container}>";
content = content.replace("return (\n    <SafeAreaView style={styles.container}>", injectedReturn);

// add at the bottom
const beforeExport = "    </>\n  );\n}\n";
content = content.replace("    </SafeAreaView>\n  );\n}", "    </SafeAreaView>\n      <FloatingGameWidget />\n" + beforeExport);

fs.writeFileSync(file, content, 'utf8');
console.log('Appended layout');
