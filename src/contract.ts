import {
	Bytes,
	dataSource,
	DataSourceContext,
	DataSourceTemplate,
	ipfs,
	json,
} from "@graphprotocol/graph-ts";
import {
	PostCreated as PostCreatedEvent,
	ProfileCreated as ProfileCreatedEvent,
} from "../generated/Contract/Contract";
import {
	ProfileMetadata,
	PostContent,
	PostCreated,
	Profile,
} from "../generated/schema";
import { ProfileMetadata as ProfileMetadataTemplate } from "../generated/templates";
import { ProfileMetadataNested as ProfileMetadataNestedTemplate } from "../generated/templates";

const POST_ID_KEY = "postID";
let profileUri: string;

export function handlePostCreated(event: PostCreatedEvent): void {
	let entity = new PostCreated(
		Bytes.fromUTF8(
			event.params.profileId.toString() +
				"-" +
				event.params.pubId.toString()
		)
	);

	entity.ownerId = event.params.profileId;
	entity.contentURI = event.params.contentURI;
	entity.timestamp = event.params.timestamp;

	entity.save();

	let arweaveIndex = entity.contentURI.indexOf("arweave.net/");
	let ipfsIndex = entity.contentURI.indexOf("/ipfs/");

	if (arweaveIndex == -1 && ipfsIndex == -1) return;

	let context = new DataSourceContext();
	context.setBytes(POST_ID_KEY, entity.id);

	if (arweaveIndex != -1) {
		let hash = entity.contentURI.substr(arweaveIndex + 12);
		DataSourceTemplate.createWithContext("ArweaveContent", [hash], context);
		return;
	}

	if (ipfsIndex != -1) {
		let hash = entity.contentURI.substr(ipfsIndex + 6);
		DataSourceTemplate.createWithContext("IpfsContent", [hash], context);
	}
}

export function handlePostContent(content: Bytes): void {
	let hash = dataSource.stringParam();
	let ctx = dataSource.context();
	let id = ctx.getBytes(POST_ID_KEY);

	let post = new PostContent(id);
	post.hash = hash;
	post.content = content.toString();
	post.save();
}

export function handleProfileCreated(event: ProfileCreatedEvent): void {
	let entity = new Profile(event.params.profileId.toString());

	entity.profileId = event.params.profileId;
	entity.creator = event.params.creator;
	entity.to = event.params.to;
	entity.handle = event.params.handle;
	entity.imageURI = event.params.imageURI;
	entity.followModule = event.params.followModule;
	entity.followModuleReturnData = event.params.followModuleReturnData;
	entity.followNFTURI = event.params.followNFTURI;
	entity.timestamp = event.params.timestamp;

	profileUri = event.params.followNFTURI;

	let context = new DataSourceContext();
	context.setString("type", "ProfileMetadata");
	ProfileMetadataTemplate.createWithContext(profileUri, context);

	entity.save();
}

export function handleProfileMetadata(content: Bytes): void {
	let ctx = dataSource.context();
	let type = ctx.getString("type");

	if (type == "ProfileMetadata") {
		let profileMetadataId = dataSource.stringParam() + "-ProfileMetadata";
		let profileMetadata = new ProfileMetadata(profileMetadataId);

		const value = json.fromBytes(content).toObject();

		if (value) {
			const name = value.get("name");
			const description = value.get("description");
			const animation_url = value.get("animation_url");
			const image = value.get("image");

			if (name && description && animation_url && image) {
				profileMetadata.name = name.toString();
				profileMetadata.description = description.toString();
				profileMetadata.animation_url = animation_url.toString();
				profileMetadata.image = image.toString();
				profileMetadata.save();
			}
			if (image) {
				let imageIpfsHash = image.toString();
				ProfileMetadataNestedTemplate.create(imageIpfsHash);
			}
		}
	}
}
