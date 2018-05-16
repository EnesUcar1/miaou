exports.name = "Dices";

const DiceRollDefinition = require("./DiceRollDefinition.js");
const operators = {
	"=": (a, b)=>a==b,
	"==": (a, b)=>a==b,
	"<": (a, b)=>a<b,
	">": (a, b)=>a>b,
	"<=": (a, b)=>a<=b,
	">=": (a, b)=>a>=b,
};

let fmt;
let cmdArgRegex;

exports.init = async function(miaou){
	fmt = miaou.lib("fmt");
	cmdArgRegex = miaou.lib("rex")`
		([a-z ]*)			// options (optional)
		(\d*\s*d\s*[\d+-]+)		// left rolldef (mandatory)
		(?:				// inequation (optional)
			\s*
			([<>=]+)		// operator
			\s*
			([\w+-]+)		// right rolldef or scalar
		)?
		\s*$
		/i`;
}

function showDef(def, options){
	let md = def.description();
	md += `, expecting **${def.expect()}**`;
	if (options.roll) {
		if (def.N>50000) throw new Error("Too Many Dice : Board is flooded");
		if (def.N<=30) {
			let roll = def.roll();
			md += `\nRoll: **${roll.result}**`;
			md += "\n" + fmt.tbl({
				cols: roll.dice.map((_, i) => i+1),
				rows: [roll.dice]
			});
		} else {
			md += `\nRoll: **${def.sum()}**`
		}
	}
	if (options.distrib && def.N>1 && def.N*def.S<10000) {
		md += "\n## Distribution:\n" + def.distribution().md();
	}
	return md;
}

function showDefScalar(def, operator, scalar, options){
	let md = def.description();
	let p = def.distribution().compareToScalar(operator, scalar);
	md += `\nProbability to have ${def.str()} ${operator.name} ${scalar} : **${fmt.float(p*100)}%**`;
	if (options.roll) {
		let sum = def.sum();
		md += `\nRoll: ${sum} => **${operator(sum, scalar) ? "yes" : "no"}**`
	}
	if (options.distrib && def.N>1 && def.N*def.S<=5000) {
		md += "\n## Distribution:\n" + def.distribution().md();
	}
	return md;
}

function showDefDef(defA, operator, defB, options){
	let md = "";
	let distA = defA.distribution();
	let distB = defB.distribution();
	let p = distA.compareToDistribution(operator, distB);
	md += `\nProbability to have ${defA.str()} ${operator.name} ${defB.str()} : **${fmt.float(p*100)}%**`;
	if (options.roll) {
		let sa = defA.sum();
		let sb = defB.sum();
		md += "\n## Roll:";
		md += "\n" + fmt.tbl({
			cols: [ defA.str(), operator.name, defB.str() ],
			rows: [[ sa, `**${operator(sa, sb) ? "yes" : "no"}**`, sb ]]
		});
	}
	if (options.distrib && defA.N>1 && defB.N>1) {
		let min = Math.min(distA.minPossibleValue(), distB.minPossibleValue());
		let max = Math.max(distA.maxPossibleValue(), distB.maxPossibleValue());
		if (max-min<=500) {
			md += "\n## Distribution:\n";
			let rows = [];
			for (let v=min; v<=max; v++) {
				let pa = distA.probability(v);
				let pb = distB.probability(v);
				if (pa+pb<10**-10) continue;
				rows.push([v, `${fmt.float(pa*100)}%`, `${fmt.float(pb*100)}%`]);
			}
			md += "#graph(hideTable,compare)\n" + fmt.tbl({
				cols: ["value", `proba(${defA.str()})`, `proba(${defB.str()})`],
				aligns: "rcc",
				rows
			});
		}
	}
	return md;
}

function onCommand(ct){
	let match = ct.args.match(cmdArgRegex);
	if (!match) throw new Error("Invalid command");
	let [, soptions, left, op, right] = match;
	let options = {};
	options.all = /\ball\b/.test(soptions);
	options.roll = options.all || /\broll\b/.test(soptions);
	options.distrib = options.all || !options.roll || /\bdist/.test(soptions);
	let leftDef = new DiceRollDefinition(left);
	let md;
	if (op) {
		let operator = operators[op];
		if (!operator) throw new Error("Unknown Operator: "+op);
		if (right==+right) {
			md = showDefScalar(leftDef, operator, +right, options);
		} else {
			let rightDef = new DiceRollDefinition(right);
			md = showDefDef(leftDef, operator, rightDef, options);
		}
	} else {
		md = showDef(leftDef, options);
	}
	let duration = ct.end();
	md += `\n*duration: ${duration}µs*`;
	ct.reply(md, md.length>800);
}

exports.registerCommands = function(registerCommand){
	registerCommand({
		name: 'dice',
		fun: onCommand,
		help: "roll some dice. Exemple: `!!dice 3D24`",
		detailedHelp: "Examples:"
			+ "\n* `!!dice D6`"
			+ "\n* `!!dice 2D6+5`"
			+ "\n* `!!dice 7d24`"
	});
}
