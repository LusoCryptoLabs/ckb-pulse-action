export async function pay(tx, signer) {
  await tx.completeFeeBy(signer)
  return signer.sendTransaction(tx)
}
