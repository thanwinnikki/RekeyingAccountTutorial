const algosdk = require("algosdk");

const algodClient = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN,
  process.env.ALGOD_SERVER,
  process.env.ALGOD_PORT
);

const creator = algosdk.mnemonicToSecretKey(process.env.MNEMONIC_CREATOR);

const submitToNetwork = async (signedTxn) => {
  // send txn
  let tx = await algodClient.sendRawTransaction(signedTxn).do();
  console.log("Transaction : " + tx.txId);

  // Wait for transaction to be confirmed
  confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);

  //Get the completed Transaction
  console.log(
    "Transaction " +
      tx.txId +
      " confirmed in round " +
      confirmedTxn["confirmed-round"]
  );

  return confirmedTxn;
};

const sendAlgos = async (sender, receiver, amount) => {
  // create suggested parameters
  const suggestedParams = await algodClient.getTransactionParams().do();

  let txn = algosdk.makePaymentTxnWithSuggestedParams(
    sender.addr,
    receiver.addr,
    amount,
    undefined,
    undefined,
    suggestedParams
  );

  // sign the transaction
  const signedTxn = txn.signTxn(sender.sk);

  const confirmedTxn = await submitToNetwork(signedTxn);
};

(async () => {
  // // Account A
  let myAccountA = algosdk.generateAccount();
  console.log("My account A address: %s", myAccountA.addr);

  // // Account B
  let myAccountB = algosdk.generateAccount();
  console.log("My account B address: %s", myAccountB.addr);

  // // Account C
  let myAccountC = algosdk.generateAccount();
  console.log("My account C address: %s", myAccountC.addr);

  // // Write your code here
  // Transfer algos to all 3 accounts to initialise
  await sendAlgos(creator, myAccountA, 1e6);
  await sendAlgos(creator, myAccountB, 1e6);
  await sendAlgos(creator, myAccountC, 1e6);

  // Create multi-sig account with B and C
  const mparams = {
    version: 1,
    threshold: 1,
    addrs: [myAccountB.addr, myAccountC.addr],
  };

  let multsigaddr = algosdk.multisigAddress(mparams);
  console.log("Multisig Address: " + multsigaddr);

  // Rekey account A to multi-sig account
  let params = await algodClient.getTransactionParams().do();

  let txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: myAccountA.addr,
    to: myAccountA.addr,
    amount: 0,
    suggestedParams: params,
    rekeyTo: multsigaddr,
  });

  let signedTxn = txn.signTxn(myAccountA.sk);
  await submitToNetwork(signedTxn);

  // Create txn to send from A to B
  txnAtoB = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: myAccountA.addr,
    to: myAccountB.addr,
    amount: 1e5,
    suggestedParams: params,
  });

  // Let C sign the txnAtoB
  let signedtxnAtoB = algosdk.signMultisigTransaction(
    txnAtoB,
    mparams,
    myAccountC.sk
  );
  await submitToNetwork(signedtxnAtoB.blob);

  // Check final account amounts
  console.log(
    "Account A balance: ",
    await algodClient.accountInformation(myAccountA.addr).do()
  );
  console.log(
    "Account B balance: ",
    await algodClient.accountInformation(myAccountB.addr).do()
  );
})();
