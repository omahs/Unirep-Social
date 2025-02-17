// @ts-ignore
import { ethers } from 'hardhat'
import { BigNumber, BigNumberish } from 'ethers'
import { expect } from 'chai'
import { deployUnirep } from '@unirep/contracts/deploy'
import { genRandomSalt, ZkIdentity } from '@unirep/crypto'
import { defaultProver } from '@unirep/circuits/provers/defaultProver'

import { deployUnirepSocial, UnirepSocial } from '../src/utils'
import { genUserState, publishPost } from './utils'

import { ActionType, UnirepSocialSynchronizer } from '../src/synchronizer'
import { schema } from '../src/schema'

import { SQLiteConnector, DB } from 'anondb/node'
import { genEpochKey } from '@unirep/core'

let synchronizer: UnirepSocialSynchronizer
const attestingFee = BigNumber.from(1)
let db: DB

describe('Synchronzier processes events', function () {
    this.timeout(0)

    let unirepContract
    let unirepSocialContract: UnirepSocial

    before(async () => {
        const accounts = await ethers.getSigners()
        unirepContract = await deployUnirep(accounts[0], {
            attestingFee,
        })
        unirepSocialContract = await deployUnirepSocial(
            accounts[0],
            unirepContract.address,
            {
                airdropReputation: 30,
            }
        )
        db = await SQLiteConnector.create(schema, ':memory:')
        synchronizer = new UnirepSocialSynchronizer(
            db,
            defaultProver,
            unirepContract,
            unirepSocialContract
        )
        // now create an attester
        await unirepContract
            .connect(accounts[1])
            .attesterSignUp()
            .then((t) => t.wait())
        await synchronizer.start()
    })

    it('submit post should succeed and update db', async () => {
        const attesterId = BigInt(
            await unirepContract.attesters(unirepSocialContract.address)
        )
        const id = new ZkIdentity()
        await unirepSocialContract
            .userSignUp(id.genIdentityCommitment())
            .then((t) => t.wait())
        const userState = await genUserState(
            ethers.provider,
            unirepContract.address,
            id
        )
        const proveGraffiti = BigInt(0)
        const minPosRep = 0
        const graffitiPreImage = BigInt(0)
        const epkNonce = 0
        const defaultPostReputation = 5

        const reputationProof = await userState.genProveReputationProof(
            attesterId,
            epkNonce,
            minPosRep,
            proveGraffiti,
            graffitiPreImage,
            defaultPostReputation
        )

        const content = 'some post text'
        const hashedContent = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes(content)
        )
        const tx = await unirepSocialContract.publishPost(
            hashedContent,
            reputationProof.publicSignals,
            reputationProof.proof,
            { value: attestingFee }
        )

        const { transactionHash } = await tx.wait()
        await synchronizer.waitForSync()
        const post = await db.findOne('Post', {
            where: {
                transactionHash,
                hashedContent,
                epochKey: reputationProof.epochKey,
                epoch: Number(reputationProof.epoch),
                proveMinRep: minPosRep !== 0 ? true : false,
                minRep: minPosRep,
                status: 1,
            },
        })
        expect(post).not.to.be.null
        const record = await db.findOne('Record', {
            where: {
                to: reputationProof.epochKey,
                from: reputationProof.epochKey,
                upvote: 0,
                downvote: defaultPostReputation,
                epoch: Number(reputationProof.epoch),
                action: ActionType.Post,
                data: '',
                transactionHash,
            },
        })
        expect(record).not.to.be.null
    })

    it('submit post should succeed and update db (if data saved before)', async () => {
        const attesterId = BigInt(
            await unirepContract.attesters(unirepSocialContract.address)
        )
        const id = new ZkIdentity()
        await unirepSocialContract
            .userSignUp(id.genIdentityCommitment())
            .then((t) => t.wait())
        const userState = await genUserState(
            ethers.provider,
            unirepContract.address,
            id
        )
        const proveGraffiti = BigInt(0)
        const minPosRep = 0
        const graffitiPreImage = BigInt(0)
        const epkNonce = 0
        const defaultPostReputation = 5

        const reputationProof = await userState.genProveReputationProof(
            attesterId,
            epkNonce,
            minPosRep,
            proveGraffiti,
            graffitiPreImage,
            defaultPostReputation
        )

        const content = 'some post text'
        const hashedContent = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes(content)
        )

        const { hash: transactionHash, wait } =
            await unirepSocialContract.publishPost(
                hashedContent,
                reputationProof.publicSignals,
                reputationProof.proof,
                { value: attestingFee }
            )

        const savedPost = await db.create('Post', {
            content,
            hashedContent,
            epochKey: reputationProof.epochKey,
            epoch: Number(reputationProof.epoch),
            proveMinRep: minPosRep !== 0 ? true : false,
            minRep: minPosRep,
            posRep: 0,
            negRep: 0,
            status: 0,
            transactionHash,
        })

        await wait()
        await synchronizer.waitForSync()
        const post = await db.findOne('Post', {
            where: {
                transactionHash,
                hashedContent,
                epochKey: reputationProof.epochKey,
                epoch: Number(reputationProof.epoch),
                proveMinRep: minPosRep !== 0 ? true : false,
                minRep: minPosRep,
                status: 1,
            },
        })
        expect(post).not.to.be.null
        const record = await db.findOne('Record', {
            where: {
                to: reputationProof.epochKey,
                from: reputationProof.epochKey,
                upvote: 0,
                downvote: defaultPostReputation,
                epoch: Number(reputationProof.epoch),
                action: ActionType.Post,
                data: savedPost._id,
                transactionHash,
            },
        })
        expect(record).not.to.be.null
    })

    it('submit comment should succeed and update db', async () => {
        const attesterId = BigInt(
            await unirepContract.attesters(unirepSocialContract.address)
        )
        const receipt = await publishPost(unirepSocialContract, ethers.provider)
        const data = unirepSocialContract.interface.parseLog(receipt.logs[2])
        const onChainPostId = data.args._postId.toString()

        const id = new ZkIdentity()
        await unirepSocialContract
            .userSignUp(id.genIdentityCommitment())
            .then((t) => t.wait())
        const userState = await genUserState(
            ethers.provider,
            unirepContract.address,
            id
        )
        const proveGraffiti = BigInt(0)
        const minPosRep = 20,
            graffitiPreImage = BigInt(0)
        const epkNonce = 0
        const defaultCommentReputation = 3
        const reputationProof = await userState.genProveReputationProof(
            attesterId,
            epkNonce,
            minPosRep,
            proveGraffiti,
            graffitiPreImage,
            defaultCommentReputation
        )

        const content = 'some comment text'
        const hashedContent = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes(content)
        )
        const tx = await unirepSocialContract.leaveComment(
            onChainPostId,
            hashedContent,
            reputationProof.publicSignals,
            reputationProof.proof,
            { value: attestingFee }
        )

        const { transactionHash } = await tx.wait()
        await synchronizer.waitForSync()

        const { _id: postId } = await db.findOne('Post', {
            where: {
                onChainId: onChainPostId,
            },
        })
        const comment = await db.findOne('Comment', {
            where: {
                transactionHash,
                postId,
                hashedContent,
                epochKey: reputationProof.epochKey,
                epoch: Number(reputationProof.epoch),
                proveMinRep: minPosRep ? true : false,
                minRep: minPosRep,
                status: 1,
            },
        })
        expect(comment).not.to.be.null
        const post = await db.findOne('Post', {
            where: {
                onChainId: onChainPostId,
                commentCount: 1,
            },
        })
        expect(post).not.to.be.null
        const record = await db.findOne('Record', {
            where: {
                to: reputationProof.epochKey,
                from: reputationProof.epochKey,
                upvote: 0,
                downvote: defaultCommentReputation,
                epoch: Number(reputationProof.epoch),
                action: ActionType.Comment,
                data: '',
                transactionHash,
            },
        })
        expect(record).not.to.be.null
    })

    it('submit comment should succeed and update db (if data saved before)', async () => {
        const attesterId = BigInt(
            await unirepContract.attesters(unirepSocialContract.address)
        )
        const receipt = await publishPost(unirepSocialContract, ethers.provider)
        const data = unirepSocialContract.interface.parseLog(receipt.logs[2])
        const onChainPostId = data.args._postId.toString()

        const id = new ZkIdentity()
        await unirepSocialContract
            .userSignUp(id.genIdentityCommitment())
            .then((t) => t.wait())
        const userState = await genUserState(
            ethers.provider,
            unirepContract.address,
            id
        )
        const proveGraffiti = BigInt(0)
        const minPosRep = 20,
            graffitiPreImage = BigInt(0)
        const epkNonce = 0
        const defaultCommentReputation = 3
        const reputationProof = await userState.genProveReputationProof(
            attesterId,
            epkNonce,
            minPosRep,
            proveGraffiti,
            graffitiPreImage,
            defaultCommentReputation
        )

        const content = 'some comment text'
        const hashedContent = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes(content)
        )

        const { hash: transactionHash, wait } =
            await unirepSocialContract.leaveComment(
                onChainPostId,
                hashedContent,
                reputationProof.publicSignals,
                reputationProof.proof,
                { value: attestingFee }
            )

        const post = await db.findOne('Post', {
            where: {
                onChainId: onChainPostId,
            },
        })
        const savedComment = await db.create('Comment', {
            postId: post._id,
            content,
            hashedContent,
            epochKey: reputationProof.epochKey,
            epoch: Number(reputationProof.epoch),
            proveMinRep: minPosRep ? true : false,
            minRep: minPosRep,
            posRep: 0,
            negRep: 0,
            status: 0,
            transactionHash,
        })

        await wait()
        await synchronizer.waitForSync()

        const comment = await db.findOne('Comment', {
            where: {
                transactionHash,
                postId: post._id,
                hashedContent,
                epochKey: reputationProof.epochKey,
                epoch: Number(reputationProof.epoch),
                proveMinRep: minPosRep ? true : false,
                minRep: minPosRep,
                status: 1,
            },
        })
        expect(comment).not.to.be.null
        {
            const post = await db.findOne('Post', {
                where: {
                    transactionHash: receipt.transactionHash,
                    commentCount: 1,
                },
            })
            expect(post).not.to.be.null
        }
        const record = await db.findOne('Record', {
            where: {
                to: reputationProof.epochKey,
                from: reputationProof.epochKey,
                upvote: 0,
                downvote: defaultCommentReputation,
                epoch: Number(reputationProof.epoch),
                action: ActionType.Comment,
                data: savedComment._id,
                transactionHash,
            },
        })
        expect(record).not.to.be.null
    })

    it('submit upvote should succeed and update db', async () => {
        const currentEpoch = await unirepContract.currentEpoch()
        const toEpochKey = genEpochKey(
            genRandomSalt(),
            currentEpoch,
            0
        ) as BigNumberish
        const attesterId = BigInt(
            await unirepContract.attesters(unirepSocialContract.address)
        )
        const id = new ZkIdentity()
        await unirepSocialContract
            .userSignUp(id.genIdentityCommitment())
            .then((t) => t.wait())
        const userState = await genUserState(
            ethers.provider,
            unirepContract.address,
            id
        )
        const proveGraffiti = BigInt(0)
        const minPosRep = 0
        const graffitiPreImage = BigInt(0)
        const epkNonce = 0
        const upvoteValue = 3
        const downvoteValue = 0
        const reputationProof = await userState.genProveReputationProof(
            attesterId,
            epkNonce,
            minPosRep,
            proveGraffiti,
            graffitiPreImage,
            upvoteValue
        )
        const tx = await unirepSocialContract.vote(
            upvoteValue,
            downvoteValue,
            toEpochKey,
            reputationProof.publicSignals,
            reputationProof.proof,
            { value: attestingFee.mul(2) }
        )

        const { transactionHash } = await tx.wait()
        await synchronizer.waitForSync()
        const vote = await db.findOne('Vote', {
            where: {
                transactionHash,
                epoch: Number(reputationProof.epoch),
                voter: reputationProof.epochKey,
                receiver: toEpochKey.toString(),
                posRep: upvoteValue,
                negRep: downvoteValue,
                graffiti: '0',
                overwriteGraffiti: false,
                postId: '',
                commentId: '',
                status: 1,
            },
        })
        expect(vote).not.to.be.null
        const record = await db.findOne('Record', {
            where: {
                to: toEpochKey.toString(),
                from: reputationProof.epochKey,
                upvote: upvoteValue,
                downvote: downvoteValue,
                epoch: Number(reputationProof.epoch),
                action: ActionType.Vote,
                transactionHash,
                data: '',
            },
        })
        expect(record).not.to.be.null
    })

    it('submit downvote should succeed and update db (if data saved before)', async () => {
        const currentEpoch = await unirepContract.currentEpoch()
        const toEpochKey = genEpochKey(
            genRandomSalt(),
            currentEpoch,
            0
        ) as BigNumberish
        const attesterId = BigInt(
            await unirepContract.attesters(unirepSocialContract.address)
        )
        const id = new ZkIdentity()
        await unirepSocialContract
            .userSignUp(id.genIdentityCommitment())
            .then((t) => t.wait())
        const userState = await genUserState(
            ethers.provider,
            unirepContract.address,
            id
        )
        const proveGraffiti = BigInt(0)
        const minPosRep = 0
        const graffitiPreImage = BigInt(0)
        const epkNonce = 0
        const upvoteValue = 0
        const downvoteValue = 5
        const reputationProof = await userState.genProveReputationProof(
            attesterId,
            epkNonce,
            minPosRep,
            proveGraffiti,
            graffitiPreImage,
            downvoteValue
        )
        const { hash: transactionHash, wait } = await unirepSocialContract.vote(
            upvoteValue,
            downvoteValue,
            toEpochKey,
            reputationProof.publicSignals,
            reputationProof.proof,
            { value: attestingFee.mul(2) }
        )

        await db.create('Vote', {
            transactionHash,
            epoch: currentEpoch.toNumber(),
            voter: reputationProof.epochKey,
            receiver: toEpochKey.toString(),
            posRep: upvoteValue,
            negRep: downvoteValue,
            graffiti: '0',
            overwriteGraffiti: false,
            postId: '',
            commentId: '',
            status: 0,
        })

        await db.create('Record', {
            to: toEpochKey.toString(),
            from: reputationProof.epochKey,
            upvote: upvoteValue,
            downvote: downvoteValue,
            epoch: currentEpoch.toNumber(),
            action: ActionType.Vote,
            transactionHash,
            data: '',
            confirmed: 0,
        })

        await wait()
        await synchronizer.waitForSync()
        const vote = await db.findOne('Vote', {
            where: {
                transactionHash,
                epoch: Number(reputationProof.epoch),
                voter: reputationProof.epochKey,
                receiver: toEpochKey.toString(),
                posRep: upvoteValue,
                negRep: downvoteValue,
                graffiti: '0',
                overwriteGraffiti: false,
                postId: '',
                commentId: '',
                status: 1,
            },
        })
        expect(vote).not.to.be.null
        const record = await db.findOne('Record', {
            where: {
                to: toEpochKey.toString(),
                from: reputationProof.epochKey,
                upvote: upvoteValue,
                downvote: downvoteValue,
                epoch: Number(reputationProof.epoch),
                action: ActionType.Vote,
                transactionHash,
                data: '',
            },
        })
        expect(record).not.to.be.null
    })
})
