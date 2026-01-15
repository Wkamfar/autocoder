/**
 * Converts a number to words (e.g., 100000 -> "one hundred thousand")
 */
export function numberToWords(num: number): string {
  if (num === 0) return "zero";
  if (num < 0) return "negative " + numberToWords(-num);

  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];

  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  const scales = ["", "thousand", "million", "billion", "trillion"];

  function convertHundreds(n: number): string {
    let result = "";
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + " hundred ";
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)];
      n %= 10;
      if (n > 0) {
        result += "-" + ones[n] + " ";
      } else {
        result += " ";
      }
    } else if (n > 0) {
      result += ones[n] + " ";
    }
    return result.trim();
  }

  function convertGroup(n: number, scaleIndex: number): string {
    if (n === 0) return "";
    const hundreds = convertHundreds(n);
    const scale = scaleIndex > 0 ? " " + scales[scaleIndex] : "";
    return hundreds + scale + " ";
  }

  let result = "";
  let scaleIndex = 0;

  while (num > 0) {
    const group = num % 1000;
    if (group > 0) {
      result = convertGroup(group, scaleIndex) + result;
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  return result.trim().replace(/\s+/g, " "); // Normalize multiple spaces to single space
}

/**
 * Formats a number to words with currency (e.g., 100000 -> "one hundred thousand dollars")
 */
export function numberToWordsWithCurrency(num: number, currency: string = "USD"): string {
  const wholePart = Math.floor(num);
  const decimalPart = Math.round((num - wholePart) * 100);
  
  let result = "";
  
  if (wholePart > 0) {
    result = numberToWords(wholePart);
  } else {
    result = "zero";
  }
  
  const currencyName = currency === "USD" ? "dollars" : currency.toLowerCase();
  result += " " + currencyName;
  
  if (decimalPart > 0) {
    const centsWords = numberToWords(decimalPart);
    result += " and " + centsWords + " cents";
  }
  
  return result;
}

/**
 * Formats a number with commas (e.g., 100000 -> "100,000")
 */
export function formatNumberWithCommas(num: number | string): string {
  const numStr = typeof num === "string" ? num : num.toString();
  // Remove any existing commas and non-numeric characters except decimal point
  const cleaned = numStr.replace(/[^\d.]/g, "");
  // Split by decimal point
  const parts = cleaned.split(".");
  // Add commas to the integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // Join back together
  return parts.join(".");
}

/**
 * Parses a formatted number string back to a number (e.g., "100,000" -> 100000)
 */
export function parseFormattedNumber(str: string): number {
  return parseFloat(str.replace(/,/g, ""));
}
